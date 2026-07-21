import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdProvider } from '@prisma/client';
import { ExchangeResult, IOAuthProvider } from './meta-oauth.strategy';

@Injectable()
export class LinkedInOAuthStrategy implements IOAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(configService: ConfigService) {
    this.clientId = configService.getOrThrow<string>('LINKEDIN_CLIENT_ID');
    this.clientSecret = configService.getOrThrow<string>(
      'LINKEDIN_CLIENT_SECRET',
    );
  }

  getProviderName(): AdProvider {
    return AdProvider.LINKEDIN;
  }

  getAuthUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'r_ads r_ads_reporting rw_ads',
      response_type: 'code',
    });
    return {
      url: `https://www.linkedin.com/oauth/v2/authorization?${params}`,
      state,
    };
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<ExchangeResult> {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn OAuth failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    if (!data.access_token)
      throw new Error(`LinkedIn OAuth error: ${JSON.stringify(data)}`);

    const adRes = await fetch('https://api.linkedin.com/v2/adAccounts', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (!adRes.ok) {
      const text = await adRes.text();
      throw new Error(
        `LinkedIn accounts fetch failed (${adRes.status}): ${text}`,
      );
    }
    const adData = await adRes.json();

    return {
      accessToken: data.access_token,
      refreshToken: undefined,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
      accountId: adData.elements?.[0]?.id || 'unknown',
      accountName: `LinkedIn (${adData.elements?.[0]?.name || 'unknown'})`,
    };
  }

  async refreshToken(
    _refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date }> {
    throw new Error(
      'LinkedIn does not support token refresh. Please reconnect.',
    );
  }
}
