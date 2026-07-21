import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdProvider } from '@prisma/client';

export interface ExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  accountId: string;
  accountName: string;
}

export interface IOAuthProvider {
  getProviderName(): AdProvider;
  getAuthUrl(
    state: string,
    redirectUri: string,
  ): { url: string; state: string };
  exchangeCode(code: string, redirectUri: string): Promise<ExchangeResult>;
  refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }>;
}

@Injectable()
export class MetaOAuthStrategy implements IOAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = 'https://graph.facebook.com/v19.0';

  constructor(configService: ConfigService) {
    this.clientId = configService.getOrThrow<string>('META_APP_ID');
    this.clientSecret = configService.getOrThrow<string>('META_APP_SECRET');
  }

  getProviderName(): AdProvider {
    return AdProvider.META;
  }

  getAuthUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'ads_management,ads_read,business_management',
      response_type: 'code',
    });
    return {
      url: `https://www.facebook.com/v19.0/dialog/oauth?${params}`,
      state,
    };
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<ExchangeResult> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const tokenRes = await fetch(
      `${this.baseUrl}/oauth/access_token?${params}`,
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(`Meta OAuth error: ${JSON.stringify(tokenData)}`);
    }

    const longLivedRes = await fetch(
      `${this.baseUrl}/oauth/access_token?grant_type=fb_exchange_token` +
        `&client_id=${this.clientId}&client_secret=${this.clientSecret}` +
        `&fb_exchange_token=${tokenData.access_token}`,
    );
    const longLived = await longLivedRes.json();
    const accessToken = longLived.access_token || tokenData.access_token;

    const accountsRes = await fetch(
      `${this.baseUrl}/me/adaccounts?fields=id,name,account_status,currency,timezone_name&access_token=${accessToken}`,
    );
    const accountsData: { data: { id: string; name: string }[] } =
      await accountsRes.json();
    const first = accountsData.data?.[0];
    if (!first) throw new Error('No Meta ad accounts found');

    return {
      accessToken,
      refreshToken: undefined,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      accountId: first.id,
      accountName: first.name,
    };
  }

  async refreshToken(refreshToken: string) {
    const res = await fetch(
      `${this.baseUrl}/oauth/access_token?grant_type=fb_exchange_token` +
        `&client_id=${this.clientId}&client_secret=${this.clientSecret}` +
        `&fb_exchange_token=${refreshToken}`,
    );
    const data = await res.json();
    if (!data.access_token) throw new Error('Meta token refresh failed');
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    };
  }
}
