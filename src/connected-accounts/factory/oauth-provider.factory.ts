import { Injectable } from '@nestjs/common';
import { AdProvider } from '@prisma/client';
import { IOAuthProvider } from '../strategies/meta-oauth.strategy';
import { MetaOAuthStrategy } from '../strategies/meta-oauth.strategy';
import { GoogleAdsOAuthStrategy } from '../strategies/google-ads-oauth.strategy';
import { TikTokOAuthStrategy } from '../strategies/tiktok-oauth.strategy';
import { SnapchatOAuthStrategy } from '../strategies/snapchat-oauth.strategy';
import { XOAuthStrategy } from '../strategies/x-oauth.strategy';
import { LinkedInOAuthStrategy } from '../strategies/linkedin-oauth.strategy';

@Injectable()
export class OAuthProviderFactory {
  private readonly strategies: Map<AdProvider, IOAuthProvider>;

  constructor(
    meta: MetaOAuthStrategy,
    googleAds: GoogleAdsOAuthStrategy,
    tiktok: TikTokOAuthStrategy,
    snapchat: SnapchatOAuthStrategy,
    x: XOAuthStrategy,
    linkedin: LinkedInOAuthStrategy,
  ) {
    this.strategies = new Map<AdProvider, IOAuthProvider>([
      [AdProvider.META, meta],
      [AdProvider.GOOGLE_ADS, googleAds],
      [AdProvider.TIKTOK, tiktok],
      [AdProvider.SNAPCHAT, snapchat],
      [AdProvider.X_ADS, x],
      [AdProvider.LINKEDIN, linkedin],
    ]);
  }

  getStrategy(provider: AdProvider): IOAuthProvider {
    const strategy = this.strategies.get(provider);
    if (!strategy) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    return strategy;
  }
}
