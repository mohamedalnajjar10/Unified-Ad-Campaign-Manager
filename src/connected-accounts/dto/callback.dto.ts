import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdProvider } from '@prisma/client';

export class CallbackDto {
  @ApiProperty({ enum: AdProvider })
  @IsEnum(AdProvider)
  provider: AdProvider;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  state: string;

  @ApiProperty()
  @IsString()
  redirectUri: string;
}
