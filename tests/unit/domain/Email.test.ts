import { describe, it, expect } from "vitest";
import { Email } from "../../../src/domain/entities/Email.js";

describe("Email", () => {
  describe("criar()", () => {
    it("should create an Email with the provided fields", () => {
      const result = Email.criar("Re: Invoice", "sender@company.com", "Please find attached.");

      expect(result.isSuccess).toBe(true);
      expect(result.value!.about).toBe("Re: Invoice");
      expect(result.value!.from).toBe("sender@company.com");
      expect(result.value!.content).toBe("Please find attached.");
    });

    it("should auto-generate a non-empty id", () => {
      const result = Email.criar("Subject", "a@test.com", "Body");

      expect(result.isSuccess).toBe(true);
      expect(result.value!.id).toBeDefined();
      expect(typeof result.value!.id).toBe("string");
      expect(result.value!.id.length).toBeGreaterThan(0);
    });

    it("should generate unique ids for different instances", () => {
      const email1 = Email.criar("Sub1", "a@test.com", "Content1").value!;
      const email2 = Email.criar("Sub2", "b@test.com", "Content2").value!;

      expect(email1.id).not.toBe(email2.id);
    });

    it("should set timestamp within the current moment", () => {
      const before = new Date();
      const email = Email.criar("Subject", "sender@test.com", "Content").value!;
      const after = new Date();

      expect(email.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(email.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should assign independent timestamps to different instances", () => {
      const email1 = Email.criar("Sub1", "a@test.com", "C1").value!;
      const email2 = Email.criar("Sub2", "b@test.com", "C2").value!;

      expect(email1.timestamp).toBeInstanceOf(Date);
      expect(email2.timestamp).toBeInstanceOf(Date);
    });

    it("should fail with empty about", () => {
      const result = Email.criar("", "sender@test.com", "Content");
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Assunto não pode ser vazio");
    });

    it("should fail with empty from", () => {
      const result = Email.criar("Subject", "", "Content");
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe("Remetente não pode ser vazio");
    });

    it("should accept empty content", () => {
      const result = Email.criar("Subject", "sender@test.com", "");
      expect(result.isSuccess).toBe(true);
      expect(result.value!.content).toBe("");
    });

    it("should preserve multiline content exactly as provided", () => {
      const multilineContent = "Line 1\nLine 2\nLine 3";
      const email = Email.criar("Subject", "sender@test.com", multilineContent).value!;

      expect(email.content).toBe(multilineContent);
    });
  });
});
