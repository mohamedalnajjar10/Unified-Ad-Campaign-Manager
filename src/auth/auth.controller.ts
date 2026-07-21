import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, AuthTokens } from './auth.service';
import { GoogleAuthGuard } from '../common/guards/google-auth.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleUser } from './auth.service';

interface AuthenticatedRequest extends Request {
  user: GoogleUser;
}

interface JwtUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  async signUp(@Body() dto: SignUpDto): Promise<AuthTokens> {
    return this.authService.signUp(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const tokens = await this.authService.validateGoogleUser(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const fragment = `#accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
    return res.redirect(`${frontendUrl}/auth/callback${fragment}`);
  }

  @Post('google/token')
  @UseGuards(GoogleAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google OAuth login (returns tokens as JSON)' })
  async googleLogin(@Req() req: AuthenticatedRequest): Promise<AuthTokens> {
    return this.authService.validateGoogleUser(req.user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshTokens(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (revoke refresh token)' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: JwtUser) {
    return user;
  }
}
