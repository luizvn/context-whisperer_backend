import { NotFoundException } from '@nestjs/common';

export class EntityNotFoundException extends NotFoundException {
  constructor(entity: string, identifier?: string | number) {
    const message = identifier
      ? `${entity} with identifier '${identifier}' not found`
      : `${entity} not found`;
    super(message);
  }
}
