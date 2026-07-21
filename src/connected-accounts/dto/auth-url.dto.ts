import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdProvider } from '@prisma/client';

export class AuthUrlDto {
  @ApiProperty({ enum: AdProvider })
  @IsEnum(AdProvider)
  provider: AdProvider;
}
