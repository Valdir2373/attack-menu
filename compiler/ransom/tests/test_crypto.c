#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/pem.h>

#define AES_KEY_LEN   32
#define GCM_NONCE_LEN 12
#define GCM_TAG_LEN   16
#define RSA_BLOB_LEN  256
#define SEED_LEN      (AES_KEY_LEN + GCM_NONCE_LEN + 8)
static const char MAGIC[8] = "2373LOCK";

static int tests_passed = 0;
static int tests_failed = 0;

#define TEST(name) \
  static void test_##name(void); \
  static void run_test_##name(void) { \
    printf("  [TEST] %s ... ", #name); \
    test_##name(); \
    tests_passed++; \
    printf("PASSED\n"); \
  } \
  static void test_##name(void)

#define ASSERT(cond) do { \
    if (!(cond)) { \
      printf("FAILED at %s:%d: %s\n", __FILE__, __LINE__, #cond); \
      tests_failed++; \
      return; \
    } \
  } while(0)

static int aes256gcm_encrypt(const unsigned char *key, const unsigned char *nonce,
                              const unsigned char *plain, size_t plain_len,
                              unsigned char *cipher, unsigned char *tag) {
    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    int len = 0, ct_len = 0;
    if (!ctx) return 0;
    if (EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL) != 1) goto fail;
    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, GCM_NONCE_LEN, NULL) != 1) goto fail;
    if (EVP_EncryptInit_ex(ctx, NULL, NULL, key, nonce) != 1) goto fail;
    if (EVP_EncryptUpdate(ctx, cipher, &len, plain, (int)plain_len) != 1) goto fail;
    ct_len = len;
    if (EVP_EncryptFinal_ex(ctx, cipher + len, &len) != 1) goto fail;
    ct_len += len;
    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, GCM_TAG_LEN, tag) != 1) goto fail;
    EVP_CIPHER_CTX_free(ctx);
    return ct_len;
fail:
    EVP_CIPHER_CTX_free(ctx);
    return 0;
}

static int aes256gcm_decrypt(const unsigned char *key, const unsigned char *nonce,
                              const unsigned char *cipher, size_t cipher_len,
                              const unsigned char *tag,
                              unsigned char *plain) {
    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    int len = 0, ok = 0;
    if (!ctx) return -1;
    if (EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL) != 1) goto done;
    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, GCM_NONCE_LEN, NULL) != 1) goto done;
    if (EVP_DecryptInit_ex(ctx, NULL, NULL, key, nonce) != 1) goto done;
    if (EVP_DecryptUpdate(ctx, plain, &len, cipher, (int)cipher_len) != 1) goto done;
    if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, GCM_TAG_LEN, (void*)tag) != 1) goto done;
    ok = (EVP_DecryptFinal_ex(ctx, plain + len, &len) > 0) ? len : -1;
    if (ok >= 0) ok = 1;
done:
    EVP_CIPHER_CTX_free(ctx);
    return ok;
}

static EVP_PKEY *generate_rsa_key(void) {
    EVP_PKEY_CTX *ctx = EVP_PKEY_CTX_new_id(EVP_PKEY_RSA, NULL);
    EVP_PKEY *key = NULL;
    if (!ctx) return NULL;
    if (EVP_PKEY_keygen_init(ctx) <= 0) { EVP_PKEY_CTX_free(ctx); return NULL; }
    if (EVP_PKEY_CTX_set_rsa_keygen_bits(ctx, 2048) <= 0) { EVP_PKEY_CTX_free(ctx); return NULL; }
    EVP_PKEY_keygen(ctx, &key);
    EVP_PKEY_CTX_free(ctx);
    return key;
}

static int rsa_oaep_encrypt(EVP_PKEY *pub, const unsigned char *plain, size_t plain_len,
                             unsigned char *cipher, size_t *cipher_len) {
    EVP_PKEY_CTX *ctx = EVP_PKEY_CTX_new(pub, NULL);
    int ok = 0;
    if (!ctx) return 0;
    if (EVP_PKEY_encrypt_init(ctx) <= 0) goto done;
    if (EVP_PKEY_CTX_set_rsa_padding(ctx, RSA_PKCS1_OAEP_PADDING) <= 0) goto done;
    if (EVP_PKEY_CTX_set_rsa_oaep_md(ctx, EVP_sha256()) <= 0) goto done;
    *cipher_len = RSA_BLOB_LEN;
    if (EVP_PKEY_encrypt(ctx, cipher, cipher_len, plain, plain_len) <= 0) goto done;
    ok = 1;
done:
    EVP_PKEY_CTX_free(ctx);
    return ok;
}

static int rsa_oaep_decrypt(EVP_PKEY *priv, const unsigned char *cipher, size_t cipher_len,
                             unsigned char *plain, size_t *plain_len) {
    EVP_PKEY_CTX *ctx = EVP_PKEY_CTX_new(priv, NULL);
    int ok = 0;
    if (!ctx) return 0;
    if (EVP_PKEY_decrypt_init(ctx) <= 0) goto done;
    if (EVP_PKEY_CTX_set_rsa_padding(ctx, RSA_PKCS1_OAEP_PADDING) <= 0) goto done;
    if (EVP_PKEY_CTX_set_rsa_oaep_md(ctx, EVP_sha256()) <= 0) goto done;
    if (EVP_PKEY_decrypt(ctx, NULL, plain_len, cipher, cipher_len) <= 0) goto done;
    if (EVP_PKEY_decrypt(ctx, plain, plain_len, cipher, cipher_len) <= 0) goto done;
    ok = 1;
done:
    EVP_PKEY_CTX_free(ctx);
    return ok;
}

TEST(aes256gcm_roundtrip) {
    unsigned char key[AES_KEY_LEN], nonce[GCM_NONCE_LEN];
    RAND_bytes(key, AES_KEY_LEN);
    RAND_bytes(nonce, GCM_NONCE_LEN);

    const char *msg = "Hello, AES-256-GCM!";
    size_t msg_len = strlen(msg);
    unsigned char ct[256], tag[GCM_TAG_LEN], pt[256];

    int ct_len = aes256gcm_encrypt(key, nonce, (const unsigned char*)msg, msg_len, ct, tag);
    ASSERT(ct_len > 0);

    int ok = aes256gcm_decrypt(key, nonce, ct, ct_len, tag, pt);
    ASSERT(ok == 1);
    ASSERT(memcmp(pt, msg, msg_len) == 0);
}

TEST(aes256gcm_different_nonce_different_ct) {
    unsigned char key[AES_KEY_LEN];
    RAND_bytes(key, AES_KEY_LEN);

    const char *msg = "Same plaintext";
    size_t msg_len = strlen(msg);

    unsigned char nonce1[GCM_NONCE_LEN], nonce2[GCM_NONCE_LEN];
    RAND_bytes(nonce1, GCM_NONCE_LEN);
    RAND_bytes(nonce2, GCM_NONCE_LEN);

    unsigned char ct1[256], ct2[256], tag1[GCM_TAG_LEN], tag2[GCM_TAG_LEN];
    aes256gcm_encrypt(key, nonce1, (const unsigned char*)msg, msg_len, ct1, tag1);
    aes256gcm_encrypt(key, nonce2, (const unsigned char*)msg, msg_len, ct2, tag2);

    ASSERT(memcmp(ct1, ct2, msg_len) != 0);
}

TEST(aes256gcm_tampered_tag_fails) {
    unsigned char key[AES_KEY_LEN], nonce[GCM_NONCE_LEN];
    RAND_bytes(key, AES_KEY_LEN);
    RAND_bytes(nonce, GCM_NONCE_LEN);

    const char *msg = "Tamper test";
    unsigned char ct[256], tag[GCM_TAG_LEN], pt[256];
    int ct_len = aes256gcm_encrypt(key, nonce, (const unsigned char*)msg, strlen(msg), ct, tag);
    ASSERT(ct_len > 0);

    tag[0] ^= 0xFF;
    int ok = aes256gcm_decrypt(key, nonce, ct, ct_len, tag, pt);
    ASSERT(ok != 1);
}

TEST(aes256gcm_tampered_ciphertext_fails) {
    unsigned char key[AES_KEY_LEN], nonce[GCM_NONCE_LEN];
    RAND_bytes(key, AES_KEY_LEN);
    RAND_bytes(nonce, GCM_NONCE_LEN);

    const char *msg = "Tamper ciphertext";
    unsigned char ct[256], tag[GCM_TAG_LEN], pt[256];
    int ct_len = aes256gcm_encrypt(key, nonce, (const unsigned char*)msg, strlen(msg), ct, tag);

    ct[3] ^= 0xFF;
    int ok = aes256gcm_decrypt(key, nonce, ct, ct_len, tag, pt);
    ASSERT(ok != 1);
}

TEST(aes256gcm_empty_plaintext) {
    unsigned char key[AES_KEY_LEN], nonce[GCM_NONCE_LEN];
    RAND_bytes(key, AES_KEY_LEN);
    RAND_bytes(nonce, GCM_NONCE_LEN);

    unsigned char ct[256], tag[GCM_TAG_LEN], pt[256];
    int ct_len = aes256gcm_encrypt(key, nonce, (const unsigned char*)"", 0, ct, tag);
    ASSERT(ct_len == 0);

    int ok = aes256gcm_decrypt(key, nonce, ct, 0, tag, pt);
    ASSERT(ok == 1);
}

TEST(aes256gcm_large_plaintext) {
    unsigned char key[AES_KEY_LEN], nonce[GCM_NONCE_LEN];
    RAND_bytes(key, AES_KEY_LEN);
    RAND_bytes(nonce, GCM_NONCE_LEN);

    size_t size = 64 * 1024;
    unsigned char *plain = malloc(size);
    unsigned char *ct = malloc(size + 16);
    unsigned char *pt = malloc(size);
    unsigned char tag[GCM_TAG_LEN];

    RAND_bytes(plain, size);

    int ct_len = aes256gcm_encrypt(key, nonce, plain, size, ct, tag);
    ASSERT(ct_len == (int)size);

    int ok = aes256gcm_decrypt(key, nonce, ct, ct_len, tag, pt);
    ASSERT(ok == 1);
    ASSERT(memcmp(plain, pt, size) == 0);

    free(plain); free(ct); free(pt);
}

TEST(rsa_oaep_roundtrip) {
    EVP_PKEY *key = generate_rsa_key();
    ASSERT(key != NULL);

    unsigned char seed[SEED_LEN];
    RAND_bytes(seed, SEED_LEN);

    unsigned char encrypted[RSA_BLOB_LEN];
    size_t enc_len = RSA_BLOB_LEN;
    ASSERT(rsa_oaep_encrypt(key, seed, SEED_LEN, encrypted, &enc_len) == 1);
    ASSERT(enc_len == RSA_BLOB_LEN);

    unsigned char decrypted[SEED_LEN + 64];
    size_t dec_len = sizeof(decrypted);
    ASSERT(rsa_oaep_decrypt(key, encrypted, enc_len, decrypted, &dec_len) == 1);
    ASSERT(dec_len == SEED_LEN);
    ASSERT(memcmp(seed, decrypted, SEED_LEN) == 0);

    EVP_PKEY_free(key);
}

TEST(rsa_wrong_key_fails) {
    EVP_PKEY *key1 = generate_rsa_key();
    EVP_PKEY *key2 = generate_rsa_key();
    ASSERT(key1 && key2);

    unsigned char data[32];
    RAND_bytes(data, 32);

    unsigned char encrypted[RSA_BLOB_LEN];
    size_t enc_len = RSA_BLOB_LEN;
    ASSERT(rsa_oaep_encrypt(key1, data, 32, encrypted, &enc_len) == 1);

    unsigned char decrypted[64];
    size_t dec_len = sizeof(decrypted);
    int ok = rsa_oaep_decrypt(key2, encrypted, enc_len, decrypted, &dec_len);
    ASSERT(ok == 0);

    EVP_PKEY_free(key1);
    EVP_PKEY_free(key2);
}

TEST(full_encrypt_decrypt_pipeline) {
    EVP_PKEY *rsa_key = generate_rsa_key();
    ASSERT(rsa_key != NULL);

    unsigned char aes_key[AES_KEY_LEN], nonce[GCM_NONCE_LEN];
    RAND_bytes(aes_key, AES_KEY_LEN);
    RAND_bytes(nonce, GCM_NONCE_LEN);

    const char *file_content = "This is secret file content that should be encrypted!";
    size_t file_len = strlen(file_content);

    unsigned char seed[SEED_LEN];
    memcpy(seed, aes_key, AES_KEY_LEN);
    memcpy(seed + AES_KEY_LEN, nonce, GCM_NONCE_LEN);
    uint64_t orig_size = (uint64_t)file_len;
    memcpy(seed + AES_KEY_LEN + GCM_NONCE_LEN, &orig_size, 8);

    unsigned char rsa_blob[RSA_BLOB_LEN];
    size_t rsa_len = RSA_BLOB_LEN;
    ASSERT(rsa_oaep_encrypt(rsa_key, seed, SEED_LEN, rsa_blob, &rsa_len) == 1);

    unsigned char ct[1024], tag[GCM_TAG_LEN];
    int ct_len = aes256gcm_encrypt(aes_key, nonce, (const unsigned char*)file_content, file_len, ct, tag);
    ASSERT(ct_len == (int)file_len);

    size_t total = 8 + RSA_BLOB_LEN + ct_len + GCM_TAG_LEN;
    unsigned char *encrypted_file = malloc(total);
    memcpy(encrypted_file, MAGIC, 8);
    memcpy(encrypted_file + 8, rsa_blob, RSA_BLOB_LEN);
    memcpy(encrypted_file + 8 + RSA_BLOB_LEN, ct, ct_len);
    memcpy(encrypted_file + 8 + RSA_BLOB_LEN + ct_len, tag, GCM_TAG_LEN);

    ASSERT(memcmp(encrypted_file, MAGIC, 8) == 0);

    unsigned char dec_seed[SEED_LEN + 64];
    size_t dec_seed_len = sizeof(dec_seed);
    ASSERT(rsa_oaep_decrypt(rsa_key, encrypted_file + 8, RSA_BLOB_LEN, dec_seed, &dec_seed_len) == 1);
    ASSERT(dec_seed_len == SEED_LEN);

    unsigned char dec_key[AES_KEY_LEN], dec_nonce[GCM_NONCE_LEN];
    uint64_t dec_orig_size;
    memcpy(dec_key, dec_seed, AES_KEY_LEN);
    memcpy(dec_nonce, dec_seed + AES_KEY_LEN, GCM_NONCE_LEN);
    memcpy(&dec_orig_size, dec_seed + AES_KEY_LEN + GCM_NONCE_LEN, 8);
    ASSERT(dec_orig_size == file_len);

    size_t enc_ct_len = total - 8 - RSA_BLOB_LEN - GCM_TAG_LEN;
    unsigned char *dec_tag = encrypted_file + 8 + RSA_BLOB_LEN + enc_ct_len;
    unsigned char decrypted[1024];
    int ok = aes256gcm_decrypt(dec_key, dec_nonce,
                                encrypted_file + 8 + RSA_BLOB_LEN, enc_ct_len,
                                dec_tag, decrypted);
    ASSERT(ok == 1);
    ASSERT(memcmp(decrypted, file_content, file_len) == 0);

    free(encrypted_file);
    EVP_PKEY_free(rsa_key);
}

TEST(magic_constant_correct) {
    ASSERT(memcmp(MAGIC, "2373LOCK", 8) == 0);
}

TEST(rand_bytes_unique) {
    unsigned char a[12], b[12];
    RAND_bytes(a, 12);
    RAND_bytes(b, 12);
    ASSERT(memcmp(a, b, 12) != 0);
}

TEST(seed_size_fits_rsa_oaep) {
    ASSERT(SEED_LEN <= 190);
}

int main(void) {
    printf("\n=== Ransom Crypto Tests ===\n\n");

    run_test_aes256gcm_roundtrip();
    run_test_aes256gcm_different_nonce_different_ct();
    run_test_aes256gcm_tampered_tag_fails();
    run_test_aes256gcm_tampered_ciphertext_fails();
    run_test_aes256gcm_empty_plaintext();
    run_test_aes256gcm_large_plaintext();
    run_test_rsa_oaep_roundtrip();
    run_test_rsa_wrong_key_fails();
    run_test_full_encrypt_decrypt_pipeline();
    run_test_magic_constant_correct();
    run_test_rand_bytes_unique();
    run_test_seed_size_fits_rsa_oaep();

    printf("\n=== Results: %d passed, %d failed ===\n\n", tests_passed, tests_failed);
    return tests_failed > 0 ? 1 : 0;
}
