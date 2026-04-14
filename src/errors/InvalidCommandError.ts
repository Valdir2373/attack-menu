import { DomainError } from "./DomainError.js";

export class InvalidCommandError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

