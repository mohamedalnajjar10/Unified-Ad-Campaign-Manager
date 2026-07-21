import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdProvider } from '@prisma/client';
import { ExchangeResult, IOAuthProvider } from './meta-oauth.strategy';

@Injectable()
export class SnapchatOAuthStrategy implements IOAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(configService: ConfigService) {
    this.clientId = configService.getOrThrow<string>('SNAPCHAT_CLIENT_ID');
    this.clientSecret = configService.getOrThrow<string>(
      'SNAPCHAT_CLIENT_SECRET',
    );
  }

  getProviderName(): AdProvider {
    return AdProvider.SNAPCHAT;
  }

  getAuthUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'ads:read ads:write',
      response_type: 'code',
    });
    return {
      url: `https://accounts.snapchat.com/login/oauth2/authorize?${params}`,
      state,
    };
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<ExchangeResult> {
    const res = await fetch(
      'https://accounts.snapchat.com/login/oauth2/access_token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Snapchat OAuth failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    if (!data.access_token)
      throw new Error(`Snapchat OAuth error: ${JSON.stringify(data)}`);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      accountId: data.ad_account_id || 'unknown',
      accountName: `Snapchat (${data.ad_account_id || 'unknown'})`,
    };
  }

  async refreshToken(refreshToken: string) {
    const res = await fetch(
      'https://accounts.snapchat.com/login/oauth2/access_token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Snapchat token refresh failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    if (!data.access_token) throw new Error('Snapchat token refresh failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    };
  }
}
