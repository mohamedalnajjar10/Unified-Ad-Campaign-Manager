import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConnectedAccountsController } from './connected-accounts.controller';
import { ConnectedAccountsService } from './connected-accounts.service';
import { EncryptionService } from './encryption.service';
import { OAuthProviderFactory } from './factory/oauth-provider.factory';
import { MetaOAuthStrategy } from './strategies/meta-oauth.strategy';
import { GoogleAdsOAuthStrategy } from './strategies/google-ads-oauth.strategy';
import { TikTokOAuthStrategy } from './strategies/tiktok-oauth.strategy';
import { SnapchatOAuthStrategy } from './strategies/snapchat-oauth.strategy';
import { XOAuthStrategy } from './strategies/x-oauth.strategy';
import { LinkedInOAuthStrategy } from './strategies/linkedin-oauth.strategy';

@Module({
  imports: [CommonModule, PrismaModule],
  controllers: [ConnectedAccountsController],
  providers: [
    ConnectedAccountsService,
    EncryptionService,
    OAuthProviderFactory,
    MetaOAuthStrategy,
    GoogleAdsOAuthStrategy,
    TikTokOAuthStrategy,
    SnapchatOAuthStrategy,
    XOAuthStrategy,
    LinkedInOAuthStrategy,
  ],
  exports: [ConnectedAccountsService],
})
export class ConnectedAccountsModule {}
