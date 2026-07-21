import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdProvider } from '@prisma/client';
import { ExchangeResult, IOAuthProvider } from './meta-oauth.strategy';

@Injectable()
export class GoogleAdsOAuthStrategy implements IOAuthProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.clientId = configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = configService.getOrThrow<string>(
      'GOOGLE_CLIENT_SECRET',
    );
    this.apiVersion = configService.get<string>(
      'GOOGLE_ADS_API_VERSION',
      'v18',
    );
  }

  getProviderName(): AdProvider {
    return AdProvider.GOOGLE_ADS;
  }

  getAuthUrl(state: string, redirectUri: string) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'https://www.googleapis.com/auth/adwords',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
    });
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      state,
    };
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<ExchangeResult> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
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
      throw new Error(
        `Google OAuth token exchange failed (${res.status}): ${text}`,
      );
    }
    const data = await res.json();
    if (!data.access_token)
      throw new Error(`Google OAuth error: ${JSON.stringify(data)}`);

    const infoRes = await fetch(
      `https://googleads.googleapis.com/${this.apiVersion}/customers:listAccessibleCustomers`,
      { headers: { Authorization: `Bearer ${data.access_token}` } },
    );
    if (!infoRes.ok) {
      const text = await infoRes.text();
      throw new Error(
        `Google Ads accounts fetch failed (${infoRes.status}): ${text}`,
      );
    }
    const info = await infoRes.json();

    const resourceName: string | undefined = info.resourceNames?.[0];
    if (!resourceName) {
      throw new Error(
        'No accessible Google Ads accounts found. Ensure your Google account has an active Google Ads account.',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      accountId: resourceName,
      accountName: `Google Ads (${resourceName})`,
    };
  }

  async refreshToken(refreshToken: string) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google token refresh failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    if (!data.access_token) throw new Error('Google token refresh failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    };
  }
}
