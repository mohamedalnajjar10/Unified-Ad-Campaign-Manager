import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { OAuthProviderFactory } from './factory/oauth-provider.factory';
import { AdProvider, AccountStatus } from '@prisma/client';

@Injectable()
export class ConnectedAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly factory: OAuthProviderFactory,
    private readonly configService: ConfigService,
  ) {}

  async getAuthUrl(userId: string, provider: AdProvider) {
    const strategy = this.factory.getStrategy(provider);
    const redirectUri = `${this.configService.get('API_URL')}/api/v1/connected-accounts/${provider.toLowerCase()}/callback`;
    const state = `${userId}:${Date.now()}`;
    return strategy.getAuthUrl(state, redirectUri);
  }

  async handleCallback(
    userId: string,
    provider: AdProvider,
    code: string,
    state: string,
    redirectUri: string,
  ) {
    const strategy = this.factory.getStrategy(provider);
    const result = await strategy.exchangeCode(code, redirectUri);

    const existing = await this.prisma.connectedAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: result.accountId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('This ad account is already connected');
    }

    const account = await this.prisma.connectedAccount.create({
      data: {
        provider,
        providerAccountId: result.accountId,
        accountName: result.accountName,
        accessToken: this.encryption.encrypt(result.accessToken),
        refreshToken: result.refreshToken
          ? this.encryption.encrypt(result.refreshToken)
          : null,
        tokenExpiresAt: result.expiresAt,
        status: AccountStatus.ACTIVE,
        userId,
      },
    });

    return {
      id: account.id,
      provider: account.provider,
      accountName: account.accountName,
      status: account.status,
    };
  }

  async findAll(userId: string) {
    return this.prisma.connectedAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        accountName: true,
        accountCurrency: true,
        accountTimezone: true,
        status: true,
        tokenExpiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(userId: string, id: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { id, userId },
    });
    if (!account) throw new NotFoundException('Connected account not found');
    return account;
  }

  async refresh(userId: string, id: string) {
    const account = await this.findById(userId, id);
    if (!account.refreshToken) {
      throw new BadRequestException('This account has no refresh token');
    }

    const strategy = this.factory.getStrategy(account.provider);
    const decryptedRefresh = this.encryption.decrypt(account.refreshToken);
    const result = await strategy.refreshToken(decryptedRefresh);

    return this.prisma.connectedAccount.update({
      where: { id },
      data: {
        accessToken: this.encryption.encrypt(result.accessToken),
        refreshToken: result.refreshToken
          ? this.encryption.encrypt(result.refreshToken)
          : account.refreshToken,
        tokenExpiresAt: result.expiresAt,
        status: AccountStatus.ACTIVE,
      },
      select: {
        id: true,
        provider: true,
        accountName: true,
        status: true,
        tokenExpiresAt: true,
      },
    });
  }

  async disconnect(userId: string, id: string) {
    await this.findById(userId, id);
    await this.prisma.connectedAccount.delete({ where: { id } });
    return { message: 'Account disconnected successfully' };
  }
}
