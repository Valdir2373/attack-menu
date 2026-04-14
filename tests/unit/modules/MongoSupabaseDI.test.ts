import { describe, it, expect, beforeEach } from "vitest";
import { MongoCredential } from "../../../src/domain/entities/MongoCredential.js";
import { SupabaseCredential } from "../../../src/domain/entities/SupabaseCredential.js";
import { MongoUri } from "../../../src/domain/value-objects/MongoUri.js";
import { SupabaseUrl } from "../../../src/domain/value-objects/SupabaseUrl.js";
import { SupabaseKey } from "../../../src/domain/value-objects/SupabaseKey.js";
import { ValidateMongoHandler } from "../../../src/application/mongo/handlers/ValidateMongoHandler.js";
import { ValidateMongoCommand } from "../../../src/application/mongo/commands/ValidateMongoCommand.js";
import { ValidateSupabaseHandler } from "../../../src/application/supabase/handlers/ValidateSupabaseHandler.js";
import { ValidateSupabaseCommand } from "../../../src/application/supabase/commands/ValidateSupabaseCommand.js";
import { Container, Token, TOKENS, createContainer } from "../../../src/shared/Container.js";
import { Result } from "../../../src/shared/Result.js";
import { Observable } from "../../../src/shared/Observable.js";
import { MockMongoValidator } from "../../mocks/MockMongoValidator.js";
import { MockSupabaseValidator } from "../../mocks/MockSupabaseValidator.js";

describe("MongoCredential entity", () => {
  it("creates with valid mongodb:// URI", () => {
    const result = MongoCredential.criar("mongodb://user:pass@localhost:27017/mydb");
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeDefined();
    expect(result.value!.uri.value).toBe("mongodb://user:pass@localhost:27017/mydb");
  });

  it("creates with valid mongodb+srv:// URI", () => {
    const result = MongoCredential.criar("mongodb+srv://admin:secret@cluster0.abc123.mongodb.net/prod");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.uri.value).toContain("mongodb+srv://");
  });

  it("fails with empty URI", () => {
    const result = MongoCredential.criar("");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URI MongoDB inv\u00e1lida");
  });

  it("fails with non-mongodb URI", () => {
    const result = MongoCredential.criar("mysql://localhost:3306/db");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URI MongoDB inv\u00e1lida");
  });

  it("fails with partial prefix without protocol separator", () => {
    const result = MongoCredential.criar("mongo://host");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URI MongoDB inv\u00e1lida");
  });

  it("generates unique ID per creation", () => {
    const a = MongoCredential.criar("mongodb://host1/db");
    const b = MongoCredential.criar("mongodb://host2/db");
    expect(a.value!.id).not.toBe(b.value!.id);
  });

  it("sets createdAt to a recent Date", () => {
    const before = new Date();
    const result = MongoCredential.criar("mongodb://localhost/test");
    const after = new Date();
    expect(result.value!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.value!.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("accepts URI with special chars in password", () => {
    const result = MongoCredential.criar("mongodb://user:p%40ss%23word@host:27017/db");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.uri.value).toContain("p%40ss%23word");
  });

  it("accepts URI with database name", () => {
    const result = MongoCredential.criar("mongodb://localhost:27017/production_db");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.uri.value).toContain("production_db");
  });

  it("accepts URI with query params", () => {
    const result = MongoCredential.criar("mongodb://host:27017/db?retryWrites=true&w=majority");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.uri.value).toContain("retryWrites=true");
  });
});


describe("MongoUri value object", () => {
  it("creates with valid mongodb:// string", () => {
    const result = MongoUri.criar("mongodb://localhost:27017");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.value).toBe("mongodb://localhost:27017");
  });

  it("creates with valid mongodb+srv:// string", () => {
    const result = MongoUri.criar("mongodb+srv://cluster.net/db");
    expect(result.isSuccess).toBe(true);
  });

  it("fails with invalid format", () => {
    const result = MongoUri.criar("postgres://host/db");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URI MongoDB inv\u00e1lida");
  });

  it("equals returns true for same URI", () => {
    const a = MongoUri.criar("mongodb://host/db").value!;
    const b = MongoUri.criar("mongodb://host/db").value!;
    expect(a.equals(b)).toBe(true);
  });

  it("equals returns false for different URIs", () => {
    const a = MongoUri.criar("mongodb://hostA/db").value!;
    const b = MongoUri.criar("mongodb://hostB/db").value!;
    expect(a.equals(b)).toBe(false);
  });

  it("fails with empty string", () => {
    const result = MongoUri.criar("");
    expect(result.isFailure).toBe(true);
  });

  it("value accessor returns original string", () => {
    const uri = "mongodb://user:pass@host:27017/mydb?retryWrites=true";
    const result = MongoUri.criar(uri);
    expect(result.value!.value).toBe(uri);
  });

  it("fails with undefined coerced to falsy", () => {
    const result = MongoUri.criar(undefined as unknown as string);
    expect(result.isFailure).toBe(true);
  });
});


describe("ValidateMongoHandler", () => {
  let validator: MockMongoValidator;
  let handler: ValidateMongoHandler;

  beforeEach(() => {
    validator = new MockMongoValidator();
    handler = new ValidateMongoHandler(validator);
  });

  it("returns isValid true when validator succeeds", async () => {
    validator.result = true;
    const result = await handler.execute(new ValidateMongoCommand("mongodb://host/db"));
    expect(result.isSuccess).toBe(true);
    expect(result.value!.isValid).toBe(true);
  });

  it("returns isValid false when validator rejects", async () => {
    validator.result = false;
    const result = await handler.execute(new ValidateMongoCommand("mongodb://host/db"));
    expect(result.isSuccess).toBe(true);
    expect(result.value!.isValid).toBe(false);
  });

  it("rejects invalid URI format before calling validator", async () => {
    const result = await handler.execute(new ValidateMongoCommand("http://not-mongo"));
    expect(result.isFailure).toBe(true);
    expect(validator.calls).toHaveLength(0);
  });

  it("rejects empty URI", async () => {
    const result = await handler.execute(new ValidateMongoCommand(""));
    expect(result.isFailure).toBe(true);
    expect(validator.calls).toHaveLength(0);
  });

  it("tracks validator calls with correct URI", async () => {
    validator.result = true;
    const uri = "mongodb://admin:pw@cluster.net:27017/test";
    await handler.execute(new ValidateMongoCommand(uri));
    expect(validator.calls).toEqual([uri]);
  });

  it("handles multiple sequential validations", async () => {
    validator.result = true;
    await handler.execute(new ValidateMongoCommand("mongodb://h1/db"));
    await handler.execute(new ValidateMongoCommand("mongodb://h2/db"));
    await handler.execute(new ValidateMongoCommand("mongodb://h3/db"));
    expect(validator.calls).toHaveLength(3);
  });

  it("passes mongodb+srv:// URIs to validator", async () => {
    validator.result = true;
    await handler.execute(new ValidateMongoCommand("mongodb+srv://user:pass@atlas.net"));
    expect(validator.calls[0]).toContain("mongodb+srv://");
  });

  it("returns error string from entity validation on failure", async () => {
    const result = await handler.execute(new ValidateMongoCommand("redis://host"));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URI MongoDB inv\u00e1lida");
  });

  it("does not catch validator exceptions", async () => {
    Object.defineProperty(validator, "validateCredentials", {
      value: async () => { throw new Error("network failure"); },
    });
    await expect(handler.execute(new ValidateMongoCommand("mongodb://host/db"))).rejects.toThrow("network failure");
  });

  it("creates command with uri property", () => {
    const cmd = new ValidateMongoCommand("mongodb://test");
    expect(cmd.uri).toBe("mongodb://test");
  });
});


describe("SupabaseCredential entity", () => {
  it("creates with valid URL and key", () => {
    const result = SupabaseCredential.criar("https://xyz.supabase.co", "abcdefghij1234567890");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.url.value).toBe("https://xyz.supabase.co");
    expect(result.value!.key.value).toBe("abcdefghij1234567890");
  });

  it("fails with URL missing supabase", () => {
    const result = SupabaseCredential.criar("https://example.com", "abcdefghij1234567890");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URL Supabase inv\u00e1lida");
  });

  it("fails with key less than 10 chars", () => {
    const result = SupabaseCredential.criar("https://test.supabase.co", "short");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Key Supabase inv\u00e1lida");
  });

  it("fails with empty URL", () => {
    const result = SupabaseCredential.criar("", "abcdefghij1234567890");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URL Supabase inv\u00e1lida");
  });

  it("fails with empty key", () => {
    const result = SupabaseCredential.criar("https://proj.supabase.co", "");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Key Supabase inv\u00e1lida");
  });

  it("generates unique ID per creation", () => {
    const a = SupabaseCredential.criar("https://a.supabase.co", "1234567890").value!;
    const b = SupabaseCredential.criar("https://b.supabase.co", "1234567890").value!;
    expect(a.id).not.toBe(b.id);
  });

  it("sets createdAt timestamp", () => {
    const before = Date.now();
    const cred = SupabaseCredential.criar("https://test.supabase.co", "longkey12345").value!;
    expect(cred.createdAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("accepts URL with https:// prefix", () => {
    const result = SupabaseCredential.criar("https://project.supabase.co", "1234567890ab");
    expect(result.isSuccess).toBe(true);
  });

  it("accepts key with JWT format", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const result = SupabaseCredential.criar("https://proj.supabase.co", jwt);
    expect(result.isSuccess).toBe(true);
  });

  it("succeeds with key exactly 10 chars", () => {
    const result = SupabaseCredential.criar("https://proj.supabase.co", "1234567890");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.key.value).toBe("1234567890");
  });
});


describe("SupabaseUrl + SupabaseKey value objects", () => {
  it("SupabaseUrl creates with valid supabase URL", () => {
    const result = SupabaseUrl.criar("https://proj.supabase.co");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.value).toBe("https://proj.supabase.co");
  });

  it("SupabaseUrl fails with URL not containing supabase", () => {
    const result = SupabaseUrl.criar("https://example.com");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("URL Supabase inv\u00e1lida");
  });

  it("SupabaseUrl equals returns true for identical URLs", () => {
    const a = SupabaseUrl.criar("https://proj.supabase.co").value!;
    const b = SupabaseUrl.criar("https://proj.supabase.co").value!;
    expect(a.equals(b)).toBe(true);
  });

  it("SupabaseKey creates with valid key", () => {
    const result = SupabaseKey.criar("abcdefghijklmnop");
    expect(result.isSuccess).toBe(true);
    expect(result.value!.value).toBe("abcdefghijklmnop");
  });

  it("SupabaseKey fails with key shorter than 10 chars", () => {
    const result = SupabaseKey.criar("123456789");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("Key Supabase inv\u00e1lida");
  });

  it("SupabaseKey equals returns true for identical keys", () => {
    const a = SupabaseKey.criar("1234567890").value!;
    const b = SupabaseKey.criar("1234567890").value!;
    expect(a.equals(b)).toBe(true);
  });

  it("SupabaseKey equals returns false for different keys", () => {
    const a = SupabaseKey.criar("1234567890").value!;
    const b = SupabaseKey.criar("0987654321").value!;
    expect(a.equals(b)).toBe(false);
  });

  it("SupabaseKey succeeds with exactly 10 characters", () => {
    const result = SupabaseKey.criar("abcdefghij");
    expect(result.isSuccess).toBe(true);
  });
});


describe("ValidateSupabaseHandler", () => {
  let validator: MockSupabaseValidator;
  let handler: ValidateSupabaseHandler;

  beforeEach(() => {
    validator = new MockSupabaseValidator();
    handler = new ValidateSupabaseHandler(validator);
  });

  it("returns isValid true when validator succeeds", async () => {
    validator.result = true;
    const result = await handler.execute(new ValidateSupabaseCommand("https://proj.supabase.co", "eyJ1234567890abcdef"));
    expect(result.isSuccess).toBe(true);
    expect(result.value!.isValid).toBe(true);
  });

  it("returns isValid false when validator rejects", async () => {
    validator.result = false;
    const result = await handler.execute(new ValidateSupabaseCommand("https://proj.supabase.co", "eyJ1234567890abcdef"));
    expect(result.isSuccess).toBe(true);
    expect(result.value!.isValid).toBe(false);
  });

  it("rejects invalid URL format before calling validator", async () => {
    const result = await handler.execute(new ValidateSupabaseCommand("https://example.com", "1234567890abcdef"));
    expect(result.isFailure).toBe(true);
    expect(validator.calls).toHaveLength(0);
  });

  it("rejects short key before calling validator", async () => {
    const result = await handler.execute(new ValidateSupabaseCommand("https://proj.supabase.co", "tiny"));
    expect(result.isFailure).toBe(true);
    expect(validator.calls).toHaveLength(0);
  });

  it("rejects when both URL and key are invalid", async () => {
    const result = await handler.execute(new ValidateSupabaseCommand("bad-url", "x"));
    expect(result.isFailure).toBe(true);
    expect(validator.calls).toHaveLength(0);
  });

  it("tracks validator calls with url and key", async () => {
    validator.result = true;
    const url = "https://test.supabase.co";
    const key = "abcdefghijklmnop";
    await handler.execute(new ValidateSupabaseCommand(url, key));
    expect(validator.calls).toEqual([{ url, key }]);
  });

  it("handles multiple sequential validations", async () => {
    validator.result = true;
    await handler.execute(new ValidateSupabaseCommand("https://a.supabase.co", "key1234567890"));
    await handler.execute(new ValidateSupabaseCommand("https://b.supabase.co", "key0987654321"));
    expect(validator.calls).toHaveLength(2);
  });

  it("reports URL error when URL is invalid", async () => {
    const result = await handler.execute(new ValidateSupabaseCommand("", "1234567890abcdef"));
    expect(result.error).toBe("URL Supabase inv\u00e1lida");
  });

  it("reports key error when URL is valid but key is invalid", async () => {
    const result = await handler.execute(new ValidateSupabaseCommand("https://proj.supabase.co", "short"));
    expect(result.error).toBe("Key Supabase inv\u00e1lida");
  });

  it("creates command with url and key properties", () => {
    const cmd = new ValidateSupabaseCommand("https://proj.supabase.co", "mykey12345");
    expect(cmd.url).toBe("https://proj.supabase.co");
    expect(cmd.key).toBe("mykey12345");
  });
});


describe("Container + Token DI", () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it("Token stores key string", () => {
    const token = new Token<string>("MyKey");
    expect(token.key).toBe("MyKey");
  });

  it("two tokens with same key are different objects", () => {
    const a = new Token<string>("Same");
    const b = new Token<string>("Same");
    expect(a).not.toBe(b);
  });

  it("registers and resolves a value", () => {
    const token = new Token<number>("Num");
    container.register(token, () => 42);
    expect(container.resolve(token)).toBe(42);
  });

  it("resolves as singleton returning same instance", () => {
    const token = new Token<{ id: number }>("Obj");
    let counter = 0;
    container.register(token, () => ({ id: ++counter }));
    const first = container.resolve(token);
    const second = container.resolve(token);
    expect(first).toBe(second);
    expect(counter).toBe(1);
  });

  it("throws ConfigError for unregistered token", () => {
    const token = new Token<string>("Ghost");
    expect(() => container.resolve(token)).toThrowError("n\u00e3o registrada");
  });

  it("factory receives container for dependency resolution", () => {
    const depToken = new Token<string>("Dep");
    const mainToken = new Token<string>("Main");
    container.register(depToken, () => "dependency-value");
    container.register(mainToken, (c) => `got:${c.resolve(depToken)}`);
    expect(container.resolve(mainToken)).toBe("got:dependency-value");
  });

  it("resolves chain A -> B -> C", () => {
    const tokenC = new Token<string>("C");
    const tokenB = new Token<string>("B");
    const tokenA = new Token<string>("A");
    container.register(tokenC, () => "leaf");
    container.register(tokenB, (c) => `B(${c.resolve(tokenC)})`);
    container.register(tokenA, (c) => `A(${c.resolve(tokenB)})`);
    expect(container.resolve(tokenA)).toBe("A(B(leaf))");
  });

  it("register overwrites previous factory on fresh container", () => {
    const token = new Token<number>("X");
    const fresh = createContainer();
    fresh.register(token, () => 1);
    fresh.register(token, () => 2);
    expect(fresh.resolve(token)).toBe(2);
  });

  it("supports transient factory pattern", () => {
    const token = new Token<() => object>("Factory");
    container.register(token, () => () => ({}));
    const factory = container.resolve(token);
    const a = factory();
    const b = factory();
    expect(a).not.toBe(b);
  });

  it("all TOKENS keys are unique", () => {
    const keys = Object.values(TOKENS).map((t) => t.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it("TOKENS contains ILogger", () => {
    expect(TOKENS.ILogger).toBeInstanceOf(Token);
    expect(TOKENS.ILogger.key).toBe("ILogger");
  });

  it("TOKENS contains IGitHubScraper", () => {
    expect(TOKENS.IGitHubScraper).toBeInstanceOf(Token);
    expect(TOKENS.IGitHubScraper.key).toBe("IGitHubScraper");
  });

  it("TOKENS contains IMongoValidator", () => {
    expect(TOKENS.IMongoValidator.key).toBe("IMongoValidator");
  });

  it("TOKENS contains ISupabaseValidator", () => {
    expect(TOKENS.ISupabaseValidator.key).toBe("ISupabaseValidator");
  });

  it("TOKENS contains IMediator", () => {
    expect(TOKENS.IMediator.key).toBe("IMediator");
  });

  it("TOKENS contains handler tokens for Mongo", () => {
    expect(TOKENS.ValidateMongoHandler.key).toBe("ValidateMongoHandler");
    expect(TOKENS.ExecuteMongoValidationHandler.key).toBe("ExecuteMongoValidationHandler");
    expect(TOKENS.ExecuteMongoMassiveHandler.key).toBe("ExecuteMongoMassiveHandler");
  });

  it("TOKENS contains handler tokens for Supabase", () => {
    expect(TOKENS.ValidateSupabaseHandler.key).toBe("ValidateSupabaseHandler");
    expect(TOKENS.ExecuteSupabaseValidationHandler.key).toBe("ExecuteSupabaseValidationHandler");
    expect(TOKENS.ExecuteSupabaseMassiveHandler.key).toBe("ExecuteSupabaseMassiveHandler");
  });

  it("createContainer returns fresh container each call", () => {
    const c1 = createContainer();
    const c2 = createContainer();
    expect(c1).not.toBe(c2);
    const token = new Token<number>("T");
    c1.register(token, () => 10);
    expect(c1.resolve(token)).toBe(10);
    expect(() => c2.resolve(token)).toThrow();
  });

  it("register returns container for chaining", () => {
    const t1 = new Token<number>("T1");
    const t2 = new Token<string>("T2");
    const result = container.register(t1, () => 1).register(t2, () => "two");
    expect(result).toBe(container);
    expect(container.resolve(t1)).toBe(1);
    expect(container.resolve(t2)).toBe("two");
  });

  it("singleton factory is called only once even under rapid resolve", () => {
    let callCount = 0;
    const token = new Token<string>("Counted");
    container.register(token, () => { callCount++; return "val"; });
    container.resolve(token);
    container.resolve(token);
    container.resolve(token);
    expect(callCount).toBe(1);
  });
});


describe("Result pattern", () => {
  it("ok wraps value with isSuccess true", () => {
    const result = Result.ok(42);
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(42);
  });

  it("fail wraps error with isSuccess false", () => {
    const result = Result.fail<number>("something went wrong");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBe("something went wrong");
  });

  it("isFailure is inverse of isSuccess on ok", () => {
    const result = Result.ok("data");
    expect(result.isFailure).toBe(false);
  });

  it("isFailure is true on fail", () => {
    const result = Result.fail("err");
    expect(result.isFailure).toBe(true);
  });

  it("value is accessible on ok result", () => {
    const result = Result.ok({ name: "test" });
    expect(result.value).toEqual({ name: "test" });
  });

  it("error is accessible on fail result", () => {
    const result = Result.fail<string>("broken");
    expect(result.error).toBe("broken");
  });

  it("ok with undefined value", () => {
    const result = Result.ok(undefined);
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeUndefined();
  });

  it("ok with null value", () => {
    const result = Result.ok(null);
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeNull();
  });

  it("ok with complex nested object", () => {
    const data = { users: [{ id: 1, roles: ["admin"] }], total: 1 };
    const result = Result.ok(data);
    expect(result.value).toEqual(data);
    expect(result.value!.users[0].roles[0]).toBe("admin");
  });

  it("fail with empty string", () => {
    const result = Result.fail<number>("");
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe("");
  });
});


describe("Observable pattern", () => {
  it("initializes with provided value", () => {
    const obs = new Observable(10);
    expect(obs.value).toBe(10);
  });

  it("notifies subscriber on emit", () => {
    const obs = new Observable(0);
    const received: number[] = [];
    obs.subscribe((v) => received.push(v));
    obs.emit(5);
    expect(received).toEqual([5]);
  });

  it("notifies multiple subscribers", () => {
    const obs = new Observable("init");
    const a: string[] = [];
    const b: string[] = [];
    obs.subscribe((v) => a.push(v));
    obs.subscribe((v) => b.push(v));
    obs.emit("next");
    expect(a).toEqual(["next"]);
    expect(b).toEqual(["next"]);
  });

  it("unsubscribe stops future notifications", () => {
    const obs = new Observable(0);
    const received: number[] = [];
    const unsub = obs.subscribe((v) => received.push(v));
    obs.emit(1);
    unsub();
    obs.emit(2);
    expect(received).toEqual([1]);
  });

  it("emit updates the current value", () => {
    const obs = new Observable("a");
    obs.emit("b");
    expect(obs.value).toBe("b");
  });

  it("value accessor returns latest emitted value", () => {
    const obs = new Observable(0);
    obs.emit(10);
    obs.emit(20);
    expect(obs.value).toBe(20);
  });

  it("subscribe returns an unsubscribe function", () => {
    const obs = new Observable(0);
    const unsub = obs.subscribe(() => {});
    expect(typeof unsub).toBe("function");
  });

  it("unsubscribe is idempotent", () => {
    const obs = new Observable(0);
    const unsub = obs.subscribe(() => {});
    unsub();
    expect(() => unsub()).not.toThrow();
  });

  it("works with complex objects", () => {
    const obs = new Observable<{ status: string; count: number }>({ status: "idle", count: 0 });
    const snapshots: Array<{ status: string; count: number }> = [];
    obs.subscribe((v) => snapshots.push(v));
    obs.emit({ status: "running", count: 1 });
    obs.emit({ status: "done", count: 2 });
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]).toEqual({ status: "done", count: 2 });
  });

  it("delivers sequential emits in order", () => {
    const obs = new Observable(0);
    const received: number[] = [];
    obs.subscribe((v) => received.push(v));
    obs.emit(1);
    obs.emit(2);
    obs.emit(3);
    expect(received).toEqual([1, 2, 3]);
  });

  it("does not notify subscriber added after emit", () => {
    const obs = new Observable(0);
    obs.emit(1);
    const received: number[] = [];
    obs.subscribe((v) => received.push(v));
    expect(received).toHaveLength(0);
  });

  it("does not notify without emit call", () => {
    const obs = new Observable(99);
    const received: number[] = [];
    obs.subscribe((v) => received.push(v));
    expect(received).toHaveLength(0);
    expect(obs.value).toBe(99);
  });

  it("remaining subscriber still works after another unsubscribes", () => {
    const obs = new Observable(0);
    const a: number[] = [];
    const b: number[] = [];
    const unsubA = obs.subscribe((v) => a.push(v));
    obs.subscribe((v) => b.push(v));
    obs.emit(1);
    unsubA();
    obs.emit(2);
    expect(a).toEqual([1]);
    expect(b).toEqual([1, 2]);
  });

  it("emitting same value still triggers notification", () => {
    const obs = new Observable(5);
    const received: number[] = [];
    obs.subscribe((v) => received.push(v));
    obs.emit(5);
    obs.emit(5);
    expect(received).toEqual([5, 5]);
  });
});
