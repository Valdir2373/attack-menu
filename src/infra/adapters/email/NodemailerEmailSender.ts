import nodemailer from "nodemailer";
import type { IEmailSender } from "../../../domain/ports/IEmailSender.js";

export class NodemailerEmailSender implements IEmailSender {
  async send(
    from: string,
    password: string,
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: from, pass: password },
    });

    await transporter.sendMail({ from, to, subject, text: body });
  }
}

