import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdProvider } from '@prisma/client';
import { ExchangeResult, IOAuthProvider } from './meta-oauth.strategy';

@Injectable()
export class TikTokOAuthStrategy implements IOAuthProvider {
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(configService: ConfigService) {
    this.appId = configService.getOrThrow<string>('TIKTOK_APP_ID');
    this.appSecret = configService.getOrThrow<string>('TIKTOK_APP_SECRET');
  }

  getProviderName(): AdProvider {
    return AdProvider.TIKTOK;
  }

  getAuthUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: redirectUri,
      state,
      scope: 'bing.ads_management',
    });
    return {
      url: `https://ads.tiktok.com/marketing_api/auth?${params}`,
      state,
    };
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<ExchangeResult> {
    const res = await fetch(
      'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: this.appId,
          secret: this.appSecret,
          auth_code: code,
          grant_type: 'authorization_code',
        }),
      },
    );
    const { data } = await res.json();
    if (!data?.access_token) throw new Error('TikTok OAuth failed');

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000),
      accountId: data.advertiser_ids?.[0] || 'unknown',
      accountName: `TikTok (${data.advertiser_ids?.[0] || 'unknown'})`,
    };
  }

  async refreshToken(refreshToken: string) {
    const res = await fetch(
      'https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: this.appId,
          secret: this.appSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      },
    );
    const { data } = await res.json();
    if (!data?.access_token) throw new Error('TikTok token refresh failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000),
    };
  }
}
