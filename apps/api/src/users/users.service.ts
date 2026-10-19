import { Injectable } from '@nestjs/common';

import {
  CreateUserData,
  UserRecord,
  UserRepository,
} from './repositories/user.repository';

export type UserProfile = Omit<UserRecord, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
  ) {}

  async findByEmail(email: string): Promise<UserProfile | null> {
    const user = await this.userRepository.findByEmail(
      this.normalizeEmail(email),
    );

    return user ? this.toProfile(user) : null;
  }

  async findByUsername(
    username: string,
  ): Promise<UserProfile | null> {
    const user = await this.userRepository.findByUsername(
      this.normalizeUsername(username),
    );

    return user ? this.toProfile(user) : null;
  }

  async findById(id: string): Promise<UserProfile | null> {
    const user = await this.userRepository.findById(id);

    return user ? this.toProfile(user) : null;
  }

  async findForAuthenticationByEmail(
    email: string,
  ): Promise<UserRecord | null> {
    return this.userRepository.findByEmail(
      this.normalizeEmail(email),
    );
  }

  async createUser(data: CreateUserData): Promise<UserProfile> {
    const user = await this.userRepository.create({
      ...data,
      email: this.normalizeEmail(data.email),
      username: this.normalizeUsername(data.username),
    });

    return this.toProfile(user);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  private toProfile(user: UserRecord): UserProfile {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      accountStatus: user.accountStatus,
    };
  }
}