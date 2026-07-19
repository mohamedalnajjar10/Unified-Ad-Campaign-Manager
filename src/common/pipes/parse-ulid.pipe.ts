import { Injectable, BadRequestException, PipeTransform } from '@nestjs/common';

const ULID_REGEX = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i;

@Injectable()
export class ParseULIDPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!ULID_REGEX.test(value)) {
      throw new BadRequestException('Validation failed (ulid is expected)');
    }
    return value;
  }
}
