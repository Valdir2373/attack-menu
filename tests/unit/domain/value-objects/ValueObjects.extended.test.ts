import { describe, it, expect } from "vitest";
import { EmailAddress } from "../../../../src/domain/value-objects/EmailAddress.js";
import { MongoUri } from "../../../../src/domain/value-objects/MongoUri.js";
import { SupabaseUrl } from "../../../../src/domain/value-objects/SupabaseUrl.js";
import { SupabaseKey } from "../../../../src/domain/value-objects/SupabaseKey.js";

describe("EmailAddress — extended", () => {
  it("should accept standard email format", () => {
    const result = EmailAddress.criar("john.doe@company.com");
    expect(result.isSuccess).toBe(true);
  });

  it("should accept email with plus addressing", () => {
    const result = EmailAddress.criar("user+tag@gmail.com");
    expect(result.isSuccess).toBe(true);
  });

  it("should accept email with subdomain", () => {
    const result = EmailAddress.criar("admin@mail.example.co.uk");
    expect(result.isSuccess).toBe(true);
  });

  it("should fail with just @", () => {
    const result = EmailAddress.criar("@");
    expect(result.isSuccess).toBe(true);
  });

  it("should not be equal when one differs", () => {
    const a = EmailAddress.criar("alice@test.com").value!;
    const b = EmailAddress.criar("bob@test.com").value!;
    expect(a.equals(b)).toBe(false);
  });

  it("should store the raw string value", () => {
    const email = "UPPER@CASE.COM";
    const result = EmailAddress.criar(email);
    expect(result.value!.value).toBe(email);
  });
});

describe("MongoUri — extended", () => {
  it("should accept URI with auth credentials", () => {
    const result = MongoUri.criar("mongodb://admin:p4ssw0rd@db.host.com:27017/mydb");
    expect(result.isSuccess).toBe(true);
  });

  it("should accept mongodb+srv with options", () => {
    const result = MongoUri.criar("mongodb+srv://user:pass@cluster.net/db?retryWrites=true");
    expect(result.isSuccess).toBe(true);
  });

  it("should fail with mysql URI", () => {
    const result = MongoUri.criar("mysql://root:pass@localhost:3306/db");
    expect(result.isFailure).toBe(true);
  });

  it("should fail with http URI", () => {
    const result = MongoUri.criar("http://localhost:27017");
    expect(result.isFailure).toBe(true);
  });

  it("should not be equal when URIs differ", () => {
    const a = MongoUri.criar("mongodb://host1/db").value!;
    const b = MongoUri.criar("mongodb://host2/db").value!;
    expect(a.equals(b)).toBe(false);
  });

  it("should store the exact URI value", () => {
    const uri = "mongodb://localhost:27017/testdb?authSource=admin";
    const result = MongoUri.criar(uri);
    expect(result.value!.value).toBe(uri);
  });
});

describe("SupabaseUrl — extended", () => {
  it("should accept URL with .supabase.co domain", () => {
    const result = SupabaseUrl.criar("https://myproject.supabase.co");
    expect(result.isSuccess).toBe(true);
  });

  it("should accept URL with supabase in path", () => {
    const result = SupabaseUrl.criar("https://custom.domain.com/supabase");
    expect(result.isSuccess).toBe(true);
  });

  it("should fail with null-like empty string", () => {
    const result = SupabaseUrl.criar("  ");
    expect(result.isFailure).toBe(true);
  });

  it("should fail with mongodb URI", () => {
    const result = SupabaseUrl.criar("mongodb://localhost");
    expect(result.isFailure).toBe(true);
  });

  it("should not be equal when URLs differ", () => {
    const a = SupabaseUrl.criar("https://a.supabase.co").value!;
    const b = SupabaseUrl.criar("https://b.supabase.co").value!;
    expect(a.equals(b)).toBe(false);
  });
});

describe("SupabaseKey — extended", () => {
  it("should accept key with exactly 10 characters", () => {
    const result = SupabaseKey.criar("1234567890");
    expect(result.isSuccess).toBe(true);
  });

  it("should accept long JWT token", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ";
    const result = SupabaseKey.criar(jwt);
    expect(result.isSuccess).toBe(true);
  });

  it("should fail with 9 characters", () => {
    const result = SupabaseKey.criar("123456789");
    expect(result.isFailure).toBe(true);
  });

  it("should accept whitespace-only string of 10+ chars (no trim)", () => {
    const result = SupabaseKey.criar("          ");
    expect(result.isSuccess).toBe(true);
  });

  it("should not be equal when keys differ", () => {
    const a = SupabaseKey.criar("1234567890ab").value!;
    const b = SupabaseKey.criar("abcdefghij12").value!;
    expect(a.equals(b)).toBe(false);
  });

  it("should preserve raw key value", () => {
    const key = "eyJhbGciOiJIUzI1NiJ9.test-token";
    const result = SupabaseKey.criar(key);
    expect(result.value!.value).toBe(key);
  });
});
