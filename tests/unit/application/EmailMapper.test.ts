import { describe, it, expect } from "vitest";
import { EmailMapper } from "../../../src/application/email/mappers/EmailMapper.js";
import { Email } from "../../../src/domain/entities/Email.js";

describe("EmailMapper", () => {
  it("should convert Email entity to EmailOutputDTO", () => {
    const email = Email.criar("Test Subject", "sender@test.com", "Body content").value!;
    const dto = EmailMapper.toDTO(email);

    expect(dto.about).toBe("Test Subject");
    expect(dto.from).toBe("sender@test.com");
    expect(dto.content).toBe("Body content");
  });

  it("should not include id or timestamp in DTO", () => {
    const email = Email.criar("Subject", "from@test.com", "Content").value!;
    const dto = EmailMapper.toDTO(email);

    expect(dto).toEqual({
      about: "Subject",
      from: "from@test.com",
      content: "Content",
    });
    expect("id" in dto).toBe(false);
    expect("timestamp" in dto).toBe(false);
  });
});
