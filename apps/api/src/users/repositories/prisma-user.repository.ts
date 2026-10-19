import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import {
  CreateUserData,
  UserRecord,
  UserRepository,
} from './user.repository';

const userAuthSelect = {
  id: true,
  email: true,
  username: true,
  passwordHash: true,
  accountStatus: true,
} as const;

@Injectable()
export class PrismaUserRepository
  implements UserRepository
{
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findByEmail(
    normalizedEmail: string,
  ): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: userAuthSelect,
    });
  }

  async findByUsername(
    normalizedUsername: string,
  ): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { username: normalizedUsername },
      select: userAuthSelect,
    });
  }

  async findById(
    id: string,
  ): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: userAuthSelect,
    });
  }

  async create(
    data: CreateUserData,
  ): Promise<UserRecord> {
    return this.prisma.user.create({
      data,
      select: userAuthSelect,
    });
  }
}