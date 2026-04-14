import type { Email } from "../../../domain/entities/Email.js";
import type { EmailOutputDTO } from "../dto/EmailOutputDTO.js";

export class EmailMapper {
  static toDTO(entity: Email): EmailOutputDTO {
    return {
      about: entity.about,
      from: entity.from,
      content: entity.content,
    };
  }
}

