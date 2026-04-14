import nodemailer from "nodemailer";
import { IEmailValidator } from "../../../domain/ports/IEmailValidator";

export class EmailValidatorService implements IEmailValidator {
  async validateCredentials(email: string, password: string): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: email,
          pass: password,
        },
      });

      await transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}

