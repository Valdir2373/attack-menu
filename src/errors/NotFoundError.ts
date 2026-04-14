import { DomainError } from './DomainError.js';

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} não encontrado`);
  }
}

