import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({ example: 'Google OAuth access token' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
