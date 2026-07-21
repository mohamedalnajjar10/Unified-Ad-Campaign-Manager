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
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ConnectedAccountsService } from './connected-accounts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUrlDto } from './dto/auth-url.dto';
import { CallbackDto } from './dto/callback.dto';
import { AdProvider } from '@prisma/client';

@ApiTags('Connected Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('connected-accounts')
export class ConnectedAccountsController {
  constructor(
    private readonly service: ConnectedAccountsService,
    private readonly configService: ConfigService,
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
  @ApiExcludeEndpoint()
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

    const apiUrl = this.configService.get<string>(
      'API_URL',
      'http://localhost:8071',
    );
    const redirectUri = `${apiUrl}/api/v1/connected-accounts/${provider.toLowerCase()}/callback`;

    try {
      const result = await this.service.handleCallback(
        state.split(':')[0],
        provider.toUpperCase() as AdProvider,
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
