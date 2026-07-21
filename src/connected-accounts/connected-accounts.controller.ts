import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConnectedAccountsService } from './connected-accounts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUrlDto } from './dto/auth-url.dto';
import { CallbackDto } from './dto/callback.dto';
import { AdProvider } from '@prisma/client';

const VALID_PROVIDERS = new Set(Object.values(AdProvider));

@ApiTags('Connected Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('connected-accounts')
export class ConnectedAccountsController {
  constructor(
    private readonly service: ConnectedAccountsService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all connected ad accounts' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.service.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get connected account details' })
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.findById(user.id, id);
  }

  @Post('auth-url')
  @ApiOperation({ summary: 'Get OAuth URL to connect an ad platform' })
  getAuthUrl(@CurrentUser() user: { id: string }, @Body() dto: AuthUrlDto) {
    return this.service.getAuthUrl(user.id, dto.provider);
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle OAuth callback from ad platform' })
  callback(@CurrentUser() user: { id: string }, @Body() dto: CallbackDto) {
    return this.service.handleCallback(
      user.id,
      dto.provider,
      dto.code,
      dto.state,
      dto.redirectUri,
    );
  }

  @Get(':provider/callback')
  @Public()
  @ApiOperation({ summary: 'Handle OAuth redirect callback from ad platform' })
  @ApiParam({
    name: 'provider',
    enum: AdProvider,
    description: 'The ad platform provider',
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Authorization code returned by the provider',
  })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'Signed JWT state parameter containing the user ID',
  })
  @ApiQuery({
    name: 'error',
    required: false,
    description: 'Error code returned by the provider',
  })
  @ApiQuery({
    name: 'error_description',
    required: false,
    description: 'Human-readable error description from the provider',
  })
  @ApiResponse({
    status: 302,
    description:
      'Redirects to frontend callback URL with either a result or error query parameter',
  })
  async handleOAuthRedirect(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    if (error) {
      const msg = encodeURIComponent(
        `OAuth error from ${provider}: ${errorDescription || error}`,
      );
      return res.redirect(
        `${frontendUrl}/connected-accounts/callback?error=${msg}`,
      );
    }

    const providerEnum = provider.toUpperCase() as AdProvider;
    if (!VALID_PROVIDERS.has(providerEnum)) {
      const msg = encodeURIComponent(`Invalid OAuth provider: ${provider}`);
      return res.redirect(
        `${frontendUrl}/connected-accounts/callback?error=${msg}`,
      );
    }

    if (!state) {
      const msg = encodeURIComponent('Missing OAuth state parameter');
      return res.redirect(
        `${frontendUrl}/connected-accounts/callback?error=${msg}`,
      );
    }

    let payload: { sub: string };
    try {
      payload = this.jwtService.verify<{ sub: string }>(state);
    } catch {
      const msg = encodeURIComponent('Invalid or expired OAuth state');
      return res.redirect(
        `${frontendUrl}/connected-accounts/callback?error=${msg}`,
      );
    }

    if (!payload.sub) {
      const msg = encodeURIComponent('Invalid OAuth state payload');
      return res.redirect(
        `${frontendUrl}/connected-accounts/callback?error=${msg}`,
      );
    }

    const apiUrl = this.configService.get<string>(
      'API_URL',
      'http://localhost:8071',
    );
    const redirectUri = `${apiUrl}/api/v1/connected-accounts/${provider.toLowerCase()}/callback`;

    try {
      const result = await this.service.handleCallback(
        payload.sub,
        providerEnum,
        code,
        state,
        redirectUri,
      );

      const fragment = encodeURIComponent(JSON.stringify(result));
      return res.redirect(
        `${frontendUrl}/connected-accounts/callback?result=${fragment}`,
      );
    } catch (err) {
      const message = encodeURIComponent(
        err instanceof Error ? err.message : 'OAuth callback failed',
      );
      return res.redirect(
        `${frontendUrl}/connected-accounts/callback?error=${message}`,
      );
    }
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: 'Refresh OAuth token for a connected account' })
  refresh(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.refresh(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Disconnect an ad account' })
  disconnect(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.disconnect(user.id, id);
  }
}
