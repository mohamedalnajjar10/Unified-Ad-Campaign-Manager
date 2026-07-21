import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdProvider } from '@prisma/client';
import { ExchangeResult, IOAuthProvider } from './meta-oauth.strategy';

@Injectable()
export class XOAuthStrategy implements IOAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(configService: ConfigService) {
    this.clientId = configService.getOrThrow<string>('X_CLIENT_ID');
    this.clientSecret = configService.getOrThrow<string>('X_CLIENT_SECRET');
  }

  getProviderName(): AdProvider {
    return AdProvider.X_ADS;
  }

  getAuthUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'tweet.read ads:read ads:write',
      response_type: 'code',
      code_challenge: 'challenge',
      code_challenge_method: 'plain',
    });
    return { url: `https://x.com/i/oauth2/authorize?${params}`, state };
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<ExchangeResult> {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    const res = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: 'challenge',
      }),
    });
    const data = await res.json();
    if (!data.access_token)
      throw new Error(`X OAuth error: ${JSON.stringify(data)}`);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 7200) * 1000),
      accountId: data.audience || 'unknown',
      accountName: `X Ads (${data.audience || 'unknown'})`,
    };
  }

  async refreshToken(refreshToken: string) {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    const res = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: this.clientId,
      }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('X token refresh failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 7200) * 1000),
    };
  }
}
