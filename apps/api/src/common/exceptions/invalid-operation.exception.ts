import { BadRequestException } from '@nestjs/common';

export class InvalidOperationException extends BadRequestException {
  constructor(message = 'Operation not permitted in current state') {
    super(message);
  }
}
