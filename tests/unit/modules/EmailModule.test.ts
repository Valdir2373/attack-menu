import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmailCredential } from "../../../src/domain/entities/EmailCredential.js";
import { EmailAddress } from "../../../src/domain/value-objects/EmailAddress.js";
import { Email } from "../../../src/domain/entities/Email.js";
import { ValidateEmailHandler } from "../../../src/application/email/handlers/ValidateEmailHandler.js";
import { ValidateEmailCommand } from "../../../src/application/email/commands/ValidateEmailCommand.js";
import { ValidateEmailCommandValidator } from "../../../src/application/email/validators/ValidateEmailCommandValidator.js";
import { SendEmailHandler } from "../../../src/application/email/handlers/SendEmailHandler.js";
import { SendEmailCommand } from "../../../src/application/email/commands/SendEmailCommand.js";
import { FetchInboxHandler } from "../../../src/application/email/handlers/FetchInboxHandler.js";
import { FetchInboxCommand } from "../../../src/application/email/commands/FetchInboxCommand.js";
import { ImapStartListenHandler } from "../../../src/application/email/handlers/ImapStartListenHandler.js";
import { ImapStartListenCommand } from "../../../src/application/email/commands/ImapStartListenCommand.js";
import { ImapStopListenHandler } from "../../../src/application/email/handlers/ImapStopListenHandler.js";
import { ImapStopListenCommand } from "../../../src/application/email/commands/ImapStopListenCommand.js";
import { StartEmailMonitorHandler } from "../../../src/application/email/handlers/StartEmailMonitorHandler.js";
import { StartEmailMonitorCommand } from "../../../src/application/email/commands/StartEmailMonitorCommand.js";
import { StopEmailMonitorHandler } from "../../../src/application/email/handlers/StopEmailMonitorHandler.js";
import { StopEmailMonitorCommand } from "../../../src/application/email/commands/StopEmailMonitorCommand.js";
import { ReadCredentialsHandler } from "../../../src/application/email/handlers/ReadCredentialsHandler.js";
import { ReadCredentialsCommand } from "../../../src/application/email/commands/ReadCredentialsCommand.js";
import { AppendCredentialHandler } from "../../../src/application/email/handlers/AppendCredentialHandler.js";
import { AppendCredentialCommand } from "../../../src/application/email/commands/AppendCredentialCommand.js";
import { VerifyImapCredentialHandler } from "../../../src/application/email/handlers/VerifyImapCredentialHandler.js";
import { VerifyImapCredentialCommand } from "../../../src/application/email/commands/VerifyImapCredentialCommand.js";
import {
  MockEmailValidator,
  MockImapListener,
  MockEmailMonitorService,
  MockImapClient,
  MockEmailSender,
  MockFileStorage,
} from "../../mocks/index.js";
import type { ImapEvent } from "../../../src/domain/ports/IImapListener.js";

describe("Email Module", () => {
  describe("EmailCredential Entity", () => {
    it("creates a valid credential with standard email and password", () => {
      const result = EmailCredential.criar("admin@company.org", "S3cretP@ss!");
      expect(result.isSuccess).toBe(true);
      expect(result.value!.email.value).toBe("admin@company.org");
      expect(result.value!.password).toBe("S3cretP@ss!");
    });

    it("preserves the exact password including special characters", () => {
      const pass = "p@$$w0rd!#%^&*()";
      const result = EmailCredential.criar("u@x.com", pass);
      expect(result.value!.password).toBe(pass);
    });

    it("assigns a UUID-format id on creation", () => {
      const result = EmailCredential.criar("u@x.com", "pass");
      expect(result.value!.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("generates distinct ids for two credentials with the same data", () => {
      const a = EmailCredential.criar("same@x.com", "same");
      const b = EmailCredential.criar("same@x.com", "same");
      expect(a.value!.id).not.toBe(b.value!.id);
    });

    it("sets createdAt within the current second", () => {
      const before = Date.now();
      const result = EmailCredential.criar("u@x.com", "p");
      expect(result.value!.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.value!.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("fails when email is an empty string", () => {
      const result = EmailCredential.criar("", "pass");
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Email inválido");
    });

    it("fails when email has no @ symbol", () => {
      const result = EmailCredential.criar("userexample.com", "pass");
      expect(result.isFailure).toBe(true);
    });

    it("fails when password is an empty string", () => {
      const result = EmailCredential.criar("u@x.com", "");
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Password não pode ser vazio");
    });

    it("accepts a single-character password", () => {
      const result = EmailCredential.criar("u@x.com", "a");
      expect(result.isSuccess).toBe(true);
    });

    it("wraps the email string inside an EmailAddress value object", () => {
      const result = EmailCredential.criar("u@x.com", "pass");
      expect(result.value!.email).toBeInstanceOf(EmailAddress);
    });
  });

  describe("EmailAddress Value Object", () => {
    it("creates a valid email address", () => {
      const result = EmailAddress.criar("hello@world.com");
      expect(result.isSuccess).toBe(true);
      expect(result.value!.value).toBe("hello@world.com");
    });

    it("fails for an empty string", () => {
      const result = EmailAddress.criar("");
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Email inválido");
    });

    it("fails for a string without @", () => {
      const result = EmailAddress.criar("nodomain");
      expect(result.isFailure).toBe(true);
    });

    it("accepts an address with subdomains", () => {
      const result = EmailAddress.criar("user@mail.sub.domain.co.uk");
      expect(result.isSuccess).toBe(true);
    });

    it("accepts an address with plus addressing", () => {
      const result = EmailAddress.criar("user+tag@gmail.com");
      expect(result.isSuccess).toBe(true);
      expect(result.value!.value).toBe("user+tag@gmail.com");
    });

    it("equals returns true for identical addresses", () => {
      const a = EmailAddress.criar("same@x.com").value!;
      const b = EmailAddress.criar("same@x.com").value!;
      expect(a.equals(b)).toBe(true);
    });

    it("equals returns false for different addresses", () => {
      const a = EmailAddress.criar("one@x.com").value!;
      const b = EmailAddress.criar("two@x.com").value!;
      expect(a.equals(b)).toBe(false);
    });

    it("equals is case-sensitive", () => {
      const a = EmailAddress.criar("User@X.com").value!;
      const b = EmailAddress.criar("user@x.com").value!;
      expect(a.equals(b)).toBe(false);
    });

    it("accepts an address where @ is the second character", () => {
      const result = EmailAddress.criar("a@b");
      expect(result.isSuccess).toBe(true);
    });

    it("accepts an address with numeric local part", () => {
      const result = EmailAddress.criar("123@numbers.com");
      expect(result.isSuccess).toBe(true);
    });
  });

  describe("ValidateEmailHandler", () => {
    let validator: MockEmailValidator;
    let handler: ValidateEmailHandler;

    beforeEach(() => {
      validator = new MockEmailValidator();
      handler = new ValidateEmailHandler(validator);
    });

    it("returns isValid true when SMTP validator confirms the credential", async () => {
      validator.result = true;
      const result = await handler.execute(new ValidateEmailCommand("u@x.com", "pass"));
      expect(result.isSuccess).toBe(true);
      expect(result.value!.isValid).toBe(true);
    });

    it("returns isValid false when SMTP validator rejects the credential", async () => {
      validator.result = false;
      const result = await handler.execute(new ValidateEmailCommand("u@x.com", "wrong"));
      expect(result.isSuccess).toBe(true);
      expect(result.value!.isValid).toBe(false);
    });

    it("forwards the exact email and password to the validator", async () => {
      validator.result = true;
      await handler.execute(new ValidateEmailCommand("test@corp.io", "myP@ss"));
      expect(validator.calls).toHaveLength(1);
      expect(validator.calls[0]).toEqual({ email: "test@corp.io", password: "myP@ss" });
    });

    it("fails fast without calling validator when email is empty", async () => {
      const result = await handler.execute(new ValidateEmailCommand("", "pass"));
      expect(result.isFailure).toBe(true);
      expect(validator.calls).toHaveLength(0);
    });

    it("fails fast without calling validator when email lacks @", async () => {
      const result = await handler.execute(new ValidateEmailCommand("nope", "pass"));
      expect(result.isFailure).toBe(true);
      expect(validator.calls).toHaveLength(0);
    });

    it("fails fast without calling validator when password is empty", async () => {
      const result = await handler.execute(new ValidateEmailCommand("u@x.com", ""));
      expect(result.isFailure).toBe(true);
      expect(validator.calls).toHaveLength(0);
    });

    it("handles a password with unicode characters", async () => {
      validator.result = true;
      const result = await handler.execute(new ValidateEmailCommand("u@x.com", "senhaComAcentoção"));
      expect(result.isSuccess).toBe(true);
    });

    it("handles an email with a very long local part", async () => {
      validator.result = true;
      const longLocal = "a".repeat(200) + "@example.com";
      const result = await handler.execute(new ValidateEmailCommand(longLocal, "p"));
      expect(result.isSuccess).toBe(true);
    });

    it("propagates exception from validator as rejected promise", async () => {
      validator.validateCredentials = async () => { throw new Error("SMTP timeout"); };
      await expect(handler.execute(new ValidateEmailCommand("u@x.com", "p"))).rejects.toThrow("SMTP timeout");
    });

    it("handles multiple sequential validations with different results", async () => {
      validator.result = true;
      const first = await handler.execute(new ValidateEmailCommand("a@x.com", "p1"));
      validator.result = false;
      const second = await handler.execute(new ValidateEmailCommand("b@x.com", "p2"));
      expect(first.value!.isValid).toBe(true);
      expect(second.value!.isValid).toBe(false);
      expect(validator.calls).toHaveLength(2);
    });

    it("validates email with special chars in local part", async () => {
      validator.result = true;
      const result = await handler.execute(new ValidateEmailCommand("user.name+tag@domain.com", "pass"));
      expect(result.isSuccess).toBe(true);
    });

    it("returns failure Result not exception for domain validation errors", async () => {
      const result = await handler.execute(new ValidateEmailCommand("bad", "pass"));
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
    });

    it("does not mutate the command object", async () => {
      validator.result = true;
      const cmd = new ValidateEmailCommand("u@x.com", "p");
      await handler.execute(cmd);
      expect(cmd.email).toBe("u@x.com");
      expect(cmd.password).toBe("p");
    });

    it("accepts an email that is just local@tld", async () => {
      validator.result = true;
      const result = await handler.execute(new ValidateEmailCommand("x@y", "p"));
      expect(result.isSuccess).toBe(true);
    });

    it("handles password with colons which could conflict with file format", async () => {
      validator.result = true;
      const result = await handler.execute(new ValidateEmailCommand("u@x.com", "pass:with:colons"));
      expect(result.isSuccess).toBe(true);
      expect(validator.calls[0].password).toBe("pass:with:colons");
    });
  });

  describe("ValidateEmailCommandValidator", () => {
    let commandValidator: ValidateEmailCommandValidator;

    beforeEach(() => {
      commandValidator = new ValidateEmailCommandValidator();
    });

    it("returns ok for a valid command", () => {
      const result = commandValidator.validate(new ValidateEmailCommand("u@x.com", "pass"));
      expect(result.isSuccess).toBe(true);
    });

    it("fails when email is empty", () => {
      const result = commandValidator.validate(new ValidateEmailCommand("", "pass"));
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Email inválido");
    });

    it("fails when email lacks @", () => {
      const result = commandValidator.validate(new ValidateEmailCommand("nope", "pass"));
      expect(result.isFailure).toBe(true);
    });

    it("fails when password is empty", () => {
      const result = commandValidator.validate(new ValidateEmailCommand("u@x.com", ""));
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Senha não pode ser vazia");
    });

    it("fails when password is only whitespace", () => {
      const result = commandValidator.validate(new ValidateEmailCommand("u@x.com", "   "));
      expect(result.isFailure).toBe(true);
    });

    it("accepts a single non-space character as password", () => {
      const result = commandValidator.validate(new ValidateEmailCommand("u@x.com", "x"));
      expect(result.isSuccess).toBe(true);
    });

    it("accepts email with plus addressing", () => {
      const result = commandValidator.validate(new ValidateEmailCommand("a+b@c.com", "p"));
      expect(result.isSuccess).toBe(true);
    });

    it("reports email error before password error when both are invalid", () => {
      const result = commandValidator.validate(new ValidateEmailCommand("", ""));
      expect(result.error).toBe("Email inválido");
    });

    it("accepts a very long password", () => {
      const result = commandValidator.validate(new ValidateEmailCommand("u@x.com", "a".repeat(500)));
      expect(result.isSuccess).toBe(true);
    });

    it("returns Result type with correct isFailure getter", () => {
      const ok = commandValidator.validate(new ValidateEmailCommand("u@x.com", "p"));
      const fail = commandValidator.validate(new ValidateEmailCommand("bad", "p"));
      expect(ok.isFailure).toBe(false);
      expect(fail.isFailure).toBe(true);
    });
  });

  describe("SendEmailHandler", () => {
    let sender: MockEmailSender;
    let handler: SendEmailHandler;

    beforeEach(() => {
      sender = new MockEmailSender();
      handler = new SendEmailHandler(sender);
    });

    it("sends an email and returns success", async () => {
      const result = await handler.execute(
        new SendEmailCommand("from@x.com", "fp", "to@y.com", "Hi", "Body text"),
      );
      expect(result.isSuccess).toBe(true);
      expect(sender.sent).toHaveLength(1);
    });

    it("forwards all fields to the sender adapter", async () => {
      await handler.execute(
        new SendEmailCommand("a@b.com", "pw", "c@d.com", "Subject!", "Content here"),
      );
      expect(sender.sent[0]).toEqual({
        from: "a@b.com",
        to: "c@d.com",
        subject: "Subject!",
        body: "Content here",
      });
    });

    it("fires onStatus callbacks in order during send", async () => {
      const statuses: string[] = [];
      await handler.execute(
        new SendEmailCommand("a@b.com", "pw", "c@d.com", "S", "B", (msg) => statuses.push(msg)),
      );
      expect(statuses).toHaveLength(3);
      expect(statuses[0]).toContain("SMTP");
      expect(statuses[1]).toContain("Enviando");
      expect(statuses[2]).toContain("Enviado");
    });

    it("includes the recipient address in the final status message", async () => {
      const statuses: string[] = [];
      await handler.execute(
        new SendEmailCommand("a@b.com", "pw", "target@z.com", "S", "B", (msg) => statuses.push(msg)),
      );
      expect(statuses[2]).toContain("target@z.com");
    });

    it("works without onStatus callback", async () => {
      const result = await handler.execute(
        new SendEmailCommand("a@b.com", "pw", "c@d.com", "S", "B"),
      );
      expect(result.isSuccess).toBe(true);
    });

    it("propagates sender errors as rejected promise", async () => {
      sender.send = async () => { throw new Error("Connection refused"); };
      await expect(
        handler.execute(new SendEmailCommand("a@b.com", "pw", "c@d.com", "S", "B")),
      ).rejects.toThrow("Connection refused");
    });

    it("sends HTML content in the body field", async () => {
      await handler.execute(
        new SendEmailCommand("a@b.com", "pw", "c@d.com", "S", "<h1>Hello</h1>"),
      );
      expect(sender.sent[0].body).toBe("<h1>Hello</h1>");
    });

    it("handles empty subject and body", async () => {
      const result = await handler.execute(
        new SendEmailCommand("a@b.com", "pw", "c@d.com", "", ""),
      );
      expect(result.isSuccess).toBe(true);
      expect(sender.sent[0].subject).toBe("");
    });

    it("sends multiple emails sequentially via the same handler", async () => {
      await handler.execute(new SendEmailCommand("a@b.com", "pw", "r1@x.com", "S1", "B1"));
      await handler.execute(new SendEmailCommand("a@b.com", "pw", "r2@x.com", "S2", "B2"));
      expect(sender.sent).toHaveLength(2);
      expect(sender.sent[0].to).toBe("r1@x.com");
      expect(sender.sent[1].to).toBe("r2@x.com");
    });

    it("handles body with newlines and unicode", async () => {
      const body = "Linha 1\nLinha 2\nÉ isso aí!";
      await handler.execute(new SendEmailCommand("a@b.com", "pw", "c@d.com", "S", body));
      expect(sender.sent[0].body).toBe(body);
    });

    it("does not store password in the sent record", async () => {
      await handler.execute(new SendEmailCommand("a@b.com", "secret", "c@d.com", "S", "B"));
      const record = sender.sent[0] as Record<string, unknown>;
      expect(record).not.toHaveProperty("password");
    });

    it("handles a very long body without truncation", async () => {
      const longBody = "x".repeat(100_000);
      await handler.execute(new SendEmailCommand("a@b.com", "pw", "c@d.com", "S", longBody));
      expect(sender.sent[0].body).toHaveLength(100_000);
    });

    it("preserves from address exactly as provided", async () => {
      await handler.execute(new SendEmailCommand("Mixed.Case@UPPER.com", "pw", "c@d.com", "S", "B"));
      expect(sender.sent[0].from).toBe("Mixed.Case@UPPER.com");
    });

    it("handles subject with emoji characters", async () => {
      await handler.execute(new SendEmailCommand("a@b.com", "pw", "c@d.com", "Alert \u{1F6A8}", "B"));
      expect(sender.sent[0].subject).toContain("\u{1F6A8}");
    });

    it("sends to addresses with plus tags", async () => {
      await handler.execute(new SendEmailCommand("a@b.com", "pw", "user+test@d.com", "S", "B"));
      expect(sender.sent[0].to).toBe("user+test@d.com");
    });
  });

  describe("FetchInboxHandler", () => {
    let imapClient: MockImapClient;
    let handler: FetchInboxHandler;

    beforeEach(() => {
      imapClient = new MockImapClient();
      handler = new FetchInboxHandler(imapClient);
    });

    it("returns an empty array when inbox is empty", async () => {
      imapClient.fetchResult = [];
      const result = await handler.execute(new FetchInboxCommand("u@x.com", "p"));
      expect(result.isSuccess).toBe(true);
      expect(result.value!).toEqual([]);
    });

    it("returns fetched emails from the IMAP client", async () => {
      imapClient.fetchResult = [
        { uid: 1, account: "u@x.com", from: "sender@a.com", subject: "Hi", date: "2025-01-01", body: "Hello" },
      ];
      const result = await handler.execute(new FetchInboxCommand("u@x.com", "p"));
      expect(result.value!).toHaveLength(1);
      expect(result.value![0].subject).toBe("Hi");
    });

    it("passes the limit parameter to the IMAP client", async () => {
      const fetchSpy = vi.spyOn(imapClient, "fetchRecentEmails");
      await handler.execute(new FetchInboxCommand("u@x.com", "p", 5));
      expect(fetchSpy).toHaveBeenCalledWith("u@x.com", "p", 5);
    });

    it("uses default limit of 15 when not specified", async () => {
      const fetchSpy = vi.spyOn(imapClient, "fetchRecentEmails");
      await handler.execute(new FetchInboxCommand("u@x.com", "p"));
      expect(fetchSpy).toHaveBeenCalledWith("u@x.com", "p", 15);
    });

    it("returns multiple emails preserving order", async () => {
      imapClient.fetchResult = [
        { uid: 1, account: "u@x.com", from: "a@a.com", subject: "First", date: "2025-01-01", body: "" },
        { uid: 2, account: "u@x.com", from: "b@b.com", subject: "Second", date: "2025-01-02", body: "" },
        { uid: 3, account: "u@x.com", from: "c@c.com", subject: "Third", date: "2025-01-03", body: "" },
      ];
      const result = await handler.execute(new FetchInboxCommand("u@x.com", "p"));
      expect(result.value!.map((e) => e.subject)).toEqual(["First", "Second", "Third"]);
    });

    it("propagates IMAP connection errors", async () => {
      imapClient.fetchRecentEmails = async () => { throw new Error("IMAP auth failed"); };
      await expect(handler.execute(new FetchInboxCommand("u@x.com", "p"))).rejects.toThrow("IMAP auth failed");
    });

    it("preserves email body content with HTML tags", async () => {
      imapClient.fetchResult = [
        { uid: 1, account: "u@x.com", from: "a@a.com", subject: "S", date: "2025-01-01", body: "<b>Bold</b>" },
      ];
      const result = await handler.execute(new FetchInboxCommand("u@x.com", "p"));
      expect(result.value![0].body).toBe("<b>Bold</b>");
    });

    it("returns emails with all DTO fields populated", async () => {
      imapClient.fetchResult = [
        { uid: 42, account: "me@x.com", from: "them@y.com", subject: "Sub", date: "2025-06-15", body: "Content" },
      ];
      const result = await handler.execute(new FetchInboxCommand("me@x.com", "p"));
      const email = result.value![0];
      expect(email.uid).toBe(42);
      expect(email.account).toBe("me@x.com");
      expect(email.from).toBe("them@y.com");
      expect(email.date).toBe("2025-06-15");
    });

    it("handles fetching with limit of 1", async () => {
      imapClient.fetchResult = [
        { uid: 99, account: "u@x.com", from: "a@a.com", subject: "Only", date: "2025-01-01", body: "" },
      ];
      const fetchSpy = vi.spyOn(imapClient, "fetchRecentEmails");
      const result = await handler.execute(new FetchInboxCommand("u@x.com", "p", 1));
      expect(fetchSpy).toHaveBeenCalledWith("u@x.com", "p", 1);
      expect(result.value!).toHaveLength(1);
    });

    it("returns success result even with empty body emails", async () => {
      imapClient.fetchResult = [
        { uid: 1, account: "u@x.com", from: "a@a.com", subject: "NoBody", date: "2025-01-01", body: "" },
      ];
      const result = await handler.execute(new FetchInboxCommand("u@x.com", "p"));
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].body).toBe("");
    });
  });

  describe("VerifyImapCredentialHandler", () => {
    let imapClient: MockImapClient;
    let handler: VerifyImapCredentialHandler;

    beforeEach(() => {
      imapClient = new MockImapClient();
      handler = new VerifyImapCredentialHandler(imapClient);
    });

    it("returns isValid true when IMAP credential is valid", async () => {
      imapClient.verifyResult = true;
      const result = await handler.execute(new VerifyImapCredentialCommand("u@x.com", "p"));
      expect(result.value!.isValid).toBe(true);
    });

    it("returns isValid false when IMAP credential is rejected", async () => {
      imapClient.verifyResult = false;
      const result = await handler.execute(new VerifyImapCredentialCommand("u@x.com", "wrong"));
      expect(result.value!.isValid).toBe(false);
    });
  });

  describe("ImapStartListenHandler + ImapStopListenHandler", () => {
    let mockListener: MockImapListener;
    let startHandler: ImapStartListenHandler;
    let stopHandler: ImapStopListenHandler;
    const noopEvent = () => {};

    beforeEach(() => {
      mockListener = new MockImapListener();
      startHandler = new ImapStartListenHandler(() => mockListener);
      stopHandler = new ImapStopListenHandler();
    });

    it("starts listening and marks the listener as connected", async () => {
      const result = await startHandler.execute(new ImapStartListenCommand("u@x.com", "p", noopEvent));
      expect(result.isSuccess).toBe(true);
      expect(mockListener.isConnected).toBe(true);
    });

    it("passes email and password to the IMAP listener on connect", async () => {
      await startHandler.execute(new ImapStartListenCommand("test@host.com", "secret", noopEvent));
      expect(mockListener.connectCalls[0]).toEqual({ email: "test@host.com", password: "secret" });
    });

    it("exposes the created listener instance via getter", async () => {
      expect(startHandler.listener).toBeNull();
      await startHandler.execute(new ImapStartListenCommand("u@x.com", "p", noopEvent));
      expect(startHandler.listener).toBe(mockListener);
    });

    it("creates a new listener on each execute via factory", async () => {
      let callCount = 0;
      const countingFactory = () => { callCount++; return new MockImapListener(); };
      const factoryHandler = new ImapStartListenHandler(countingFactory);
      await factoryHandler.execute(new ImapStartListenCommand("a@x.com", "p", noopEvent));
      await factoryHandler.execute(new ImapStartListenCommand("b@x.com", "p", noopEvent));
      expect(callCount).toBe(2);
    });

    it("stops listening and disconnects when listener is set", async () => {
      await startHandler.execute(new ImapStartListenCommand("u@x.com", "p", noopEvent));
      stopHandler.setListener(startHandler.listener);
      const result = await stopHandler.execute(new ImapStopListenCommand("conn-1"));
      expect(result.isSuccess).toBe(true);
      expect(mockListener.isConnected).toBe(false);
    });

    it("returns success when stopping with no active listener", async () => {
      const result = await stopHandler.execute(new ImapStopListenCommand("conn-1"));
      expect(result.isSuccess).toBe(true);
    });

    it("nullifies listener reference after stopping", async () => {
      stopHandler.setListener(mockListener);
      await stopHandler.execute(new ImapStopListenCommand("conn-1"));
      const secondStop = await stopHandler.execute(new ImapStopListenCommand("conn-1"));
      expect(secondStop.isSuccess).toBe(true);
    });

    it("invokes the onEvent callback provided in the command", async () => {
      const events: ImapEvent[] = [];
      const listener = new MockImapListener();
      listener.connect = async (email, password, onEvent) => {
        listener.connectCalls.push({ email, password });
        onEvent({ type: "connected", message: "Connected!" });
      };
      const h = new ImapStartListenHandler(() => listener);
      await h.execute(new ImapStartListenCommand("u@x.com", "p", (e) => events.push(e)));
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("connected");
    });

    it("handles connect failure by propagating the error", async () => {
      const failListener = new MockImapListener();
      failListener.connect = async () => { throw new Error("DNS resolution failed"); };
      const h = new ImapStartListenHandler(() => failListener);
      await expect(h.execute(new ImapStartListenCommand("u@x.com", "p", noopEvent))).rejects.toThrow("DNS resolution");
    });

    it("can start and stop the full lifecycle without errors", async () => {
      await startHandler.execute(new ImapStartListenCommand("u@x.com", "p", noopEvent));
      expect(mockListener.isConnected).toBe(true);
      stopHandler.setListener(startHandler.listener);
      await stopHandler.execute(new ImapStopListenCommand("conn-1"));
      expect(mockListener.isConnected).toBe(false);
    });
  });

  describe("StartEmailMonitorHandler + StopEmailMonitorHandler", () => {
    let mockService: MockEmailMonitorService;
    let startHandler: StartEmailMonitorHandler;
    let stopHandler: StopEmailMonitorHandler;

    beforeEach(() => {
      mockService = new MockEmailMonitorService();
      startHandler = new StartEmailMonitorHandler(() => mockService);
      stopHandler = new StopEmailMonitorHandler();
    });

    it("starts monitoring and marks service as running", async () => {
      const result = await startHandler.execute(new StartEmailMonitorCommand("u@x.com", "p"));
      expect(result.isSuccess).toBe(true);
      expect(mockService.isRunning).toBe(true);
    });

    it("exposes the service instance after start", async () => {
      expect(startHandler.service).toBeNull();
      await startHandler.execute(new StartEmailMonitorCommand("u@x.com", "p"));
      expect(startHandler.service).toBe(mockService);
    });

    it("creates a new service per execute via factory", async () => {
      let count = 0;
      const factory = () => { count++; return new MockEmailMonitorService(); };
      const h = new StartEmailMonitorHandler(factory);
      await h.execute(new StartEmailMonitorCommand("a@x.com", "p"));
      await h.execute(new StartEmailMonitorCommand("b@x.com", "p"));
      expect(count).toBe(2);
    });

    it("returns empty array when stopping with no active service", async () => {
      const result = await stopHandler.execute(new StopEmailMonitorCommand("conn-1"));
      expect(result.isSuccess).toBe(true);
      expect(result.value!).toEqual([]);
    });

    it("returns collected emails as DTOs when stopping", async () => {
      const email = Email.criar("Subject", "from@x.com", "Content");
      mockService.emails = [email.value!];
      await startHandler.execute(new StartEmailMonitorCommand("u@x.com", "p"));
      stopHandler.setService(startHandler.service);
      const result = await stopHandler.execute(new StopEmailMonitorCommand("conn-1"));
      expect(result.value!).toHaveLength(1);
      expect(result.value![0].about).toBe("Subject");
      expect(result.value![0].from).toBe("from@x.com");
      expect(result.value![0].content).toBe("Content");
    });

    it("nullifies service reference after stopping", async () => {
      stopHandler.setService(mockService);
      await stopHandler.execute(new StopEmailMonitorCommand("conn-1"));
      const second = await stopHandler.execute(new StopEmailMonitorCommand("conn-1"));
      expect(second.value!).toEqual([]);
    });

    it("maps multiple collected emails to DTOs", async () => {
      const e1 = Email.criar("S1", "a@x.com", "C1").value!;
      const e2 = Email.criar("S2", "b@x.com", "C2").value!;
      mockService.emails = [e1, e2];
      await startHandler.execute(new StartEmailMonitorCommand("u@x.com", "p"));
      stopHandler.setService(startHandler.service);
      const result = await stopHandler.execute(new StopEmailMonitorCommand("conn-1"));
      expect(result.value!).toHaveLength(2);
      expect(result.value![0].about).toBe("S1");
      expect(result.value![1].about).toBe("S2");
    });

    it("marks service as not running after stop", async () => {
      await startHandler.execute(new StartEmailMonitorCommand("u@x.com", "p"));
      expect(mockService.isRunning).toBe(true);
      stopHandler.setService(startHandler.service);
      await stopHandler.execute(new StopEmailMonitorCommand("conn-1"));
      expect(mockService.isRunning).toBe(false);
    });

    it("handles start failure by propagating the error", async () => {
      const failService = new MockEmailMonitorService();
      failService.start = async () => { throw new Error("IMAP down"); };
      const h = new StartEmailMonitorHandler(() => failService);
      await expect(h.execute(new StartEmailMonitorCommand("u@x.com", "p"))).rejects.toThrow("IMAP down");
    });

    it("full lifecycle: start, collect, stop returns emails", async () => {
      await startHandler.execute(new StartEmailMonitorCommand("u@x.com", "p"));
      mockService.emails = [Email.criar("Alert", "sys@x.com", "Server down").value!];
      stopHandler.setService(startHandler.service);
      const result = await stopHandler.execute(new StopEmailMonitorCommand("conn-1"));
      expect(result.value![0].about).toBe("Alert");
      expect(mockService.isRunning).toBe(false);
    });
  });

  describe("ReadCredentialsHandler + AppendCredentialHandler", () => {
    let fileStorage: MockFileStorage;
    let readHandler: ReadCredentialsHandler;
    let appendHandler: AppendCredentialHandler;

    beforeEach(() => {
      fileStorage = new MockFileStorage();
      readHandler = new ReadCredentialsHandler(fileStorage);
      appendHandler = new AppendCredentialHandler(fileStorage);
    });

    it("returns empty array when file does not exist", async () => {
      const result = await readHandler.execute(new ReadCredentialsCommand("/missing.txt"));
      expect(result.isSuccess).toBe(true);
      expect(result.value!).toEqual([]);
    });

    it("parses a single credential line from file", async () => {
      fileStorage.setFile("/creds.txt", "user@x.com:password123\n");
      const result = await readHandler.execute(new ReadCredentialsCommand("/creds.txt"));
      expect(result.value!).toHaveLength(1);
      expect(result.value![0]).toEqual({ email: "user@x.com", password: "password123" });
    });

    it("parses multiple credential lines from file", async () => {
      fileStorage.setFile("/creds.txt", "a@x.com:p1\nb@x.com:p2\nc@x.com:p3\n");
      const result = await readHandler.execute(new ReadCredentialsCommand("/creds.txt"));
      expect(result.value!).toHaveLength(3);
    });

    it("skips empty lines in the file", async () => {
      fileStorage.setFile("/creds.txt", "a@x.com:p1\n\n\nb@x.com:p2\n");
      const result = await readHandler.execute(new ReadCredentialsCommand("/creds.txt"));
      expect(result.value!).toHaveLength(2);
    });

    it("skips lines without a colon separator", async () => {
      fileStorage.setFile("/creds.txt", "a@x.com:p1\nbadline\nc@x.com:p3\n");
      const result = await readHandler.execute(new ReadCredentialsCommand("/creds.txt"));
      expect(result.value!).toHaveLength(2);
    });

    it("handles password that contains colons by splitting only on the first colon", async () => {
      fileStorage.setFile("/creds.txt", "u@x.com:pass:with:colons\n");
      const result = await readHandler.execute(new ReadCredentialsCommand("/creds.txt"));
      expect(result.value![0].password).toBe("pass:with:colons");
    });

    it("appends a credential line to the file", async () => {
      fileStorage.setFile("/creds.txt", "");
      const result = await appendHandler.execute(new AppendCredentialCommand("/creds.txt", "new@x.com", "newpass"));
      expect(result.isSuccess).toBe(true);
      const readResult = await readHandler.execute(new ReadCredentialsCommand("/creds.txt"));
      expect(readResult.value![0]).toEqual({ email: "new@x.com", password: "newpass" });
    });

    it("appends to an existing file without overwriting", async () => {
      fileStorage.setFile("/creds.txt", "existing@x.com:oldpass\n");
      await appendHandler.execute(new AppendCredentialCommand("/creds.txt", "new@x.com", "newpass"));
      const result = await readHandler.execute(new ReadCredentialsCommand("/creds.txt"));
      expect(result.value!).toHaveLength(2);
      expect(result.value![0].email).toBe("existing@x.com");
      expect(result.value![1].email).toBe("new@x.com");
    });

    it("creates file content when appending to a non-existent path", async () => {
      await appendHandler.execute(new AppendCredentialCommand("/new.txt", "u@x.com", "p"));
      const result = await readHandler.execute(new ReadCredentialsCommand("/new.txt"));
      expect(result.value!).toHaveLength(1);
    });

    it("trims whitespace from email and password when reading", async () => {
      fileStorage.setFile("/creds.txt", "  user@x.com  :  secret  \n");
      const result = await readHandler.execute(new ReadCredentialsCommand("/creds.txt"));
      expect(result.value![0].email).toBe("user@x.com");
      expect(result.value![0].password).toBe("secret");
    });
  });
});
