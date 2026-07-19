import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    try {
      const hashedPassword = await hash(dto.password, 12);
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          isActive: dto.isActive,
        },
      });
      return this.excludePassword(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async findAll(query: UserQueryDto) {
    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { email: { contains: query.search } },
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return users.map(this.excludePassword);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.excludePassword(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: Prisma.UserUpdateInput = { ...dto } as any;

    if (dto.password && dto.password.trim().length > 0) {
      data.password = await hash(dto.password, 12);
    } else {
      delete data.password;
    }

    try {
      const user = await this.prisma.user.update({ where: { id }, data });
      return this.excludePassword(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  private excludePassword(
    user: Prisma.UserGetPayload<{}>,
  ): Omit<Prisma.UserGetPayload<{}>, 'password'> {
    const { password, ...rest } = user;
    return rest;
  }
}
