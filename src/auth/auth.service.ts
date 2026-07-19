import { Injectable, ConflictException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { hash, compare } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthProvider, UserRole } from '@prisma/client';

export interface GoogleUser {
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    role: UserRole;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async signUp(email: string, password: string, firstName?: string, lastName?: string): Promise<AuthTokens> {
    const hashedPassword = await hash(password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
        },
      });

      return this.generateTokens(user);
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw new InternalServerErrorException('Failed to create account');
    }
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return this.generateTokens(user);
  }

  async validateGoogleUser(googleUser: GoogleUser): Promise<AuthTokens> {
    const { providerId, email, firstName, lastName, avatar } = googleUser;

    if (!email) {
      throw new UnauthorizedException('Google account has no email');
    }

    // Check if OAuth account already exists
    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: providerId,
        },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      return this.generateTokens(existingOAuth.user);
    }

    // Check if user with this email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Link Google account to existing user
      await this.prisma.oAuthAccount.create({
        data: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: providerId,
          userId: existingUser.id,
        },
      });

      // Update avatar if not set
      if (!existingUser.avatar && avatar) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { avatar },
        });
      }

      return this.generateTokens(existingUser);
    }

    // Create new user with OAuth account
    try {
      const newUser = await this.prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          avatar,
          oauthAccounts: {
            create: {
              provider: AuthProvider.GOOGLE,
              providerAccountId: providerId,
            },
          },
        },
      });

      return this.generateTokens(newUser);
    } catch (error) {
      if (error?.code === 'P2002') {
        // Race condition: user was created between our check and create
        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          return this.generateTokens(existingUser);
        }
      }
      throw new InternalServerErrorException('Failed to create user account');
    }
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    role: UserRole;
  }): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email };

    const expiresIn = Number(this.configService.get('JWT_EXPIRES_IN', '900'));
    const refreshExpiresIn = Number(this.configService.get('JWT_REFRESH_EXPIRES_IN', '604800'));

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    // Store hashed refresh token
    await this.prisma.refreshToken.create({
      data: {
        token: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshExpiresIn * 1000),
      },
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
      },
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const hashedToken = this.hashToken(refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Token reuse detected — revoke all sessions for this user
    if (tokenRecord.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token reuse detected, all sessions revoked');
    }

    if (tokenRecord.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke old refresh token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(tokenRecord.user);
  }

  async logout(refreshToken: string): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { token: hashedToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
