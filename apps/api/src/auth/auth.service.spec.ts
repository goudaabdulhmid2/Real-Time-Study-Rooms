import { ConflictException } from '@nestjs/common';

import {
  UserProfile,
  UsersService,
} from '../users/users.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { PasswordHasherService } from './services/password-hasher.service';

describe('AuthService', () => {
  let service: AuthService;

  let usersService: {
    findByEmail: jest.Mock;
    findByUsername: jest.Mock;
    createUser: jest.Mock;
  };

  let passwordHasher: {
    hash: jest.Mock;
    verify: jest.Mock;
  };

  const dto: RegisterDto = {
    email: 'Hamid@example.com',
    username: 'Hamid_Dev',
    password: 'a-strong-password',
  };

  const userProfile: UserProfile = {
    id: 'user-uuid',
    email: 'hamid@example.com',
    username: 'hamid_dev',
    accountStatus: 'ACTIVE',
  };

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      createUser: jest.fn(),
    };

    passwordHasher = {
      hash: jest.fn(),
      verify: jest.fn(),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      passwordHasher as unknown as PasswordHasherService,
    );
  });

  it('should register a user using a password hash', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByUsername.mockResolvedValue(null);
    usersService.createUser.mockResolvedValue(userProfile);

    passwordHasher.hash.mockResolvedValue('argon2-test-hash');

    const result = await service.register(dto);

    expect(passwordHasher.hash).toHaveBeenCalledWith(
      dto.password,
    );

    expect(usersService.createUser).toHaveBeenCalledWith({
      email: dto.email,
      username: dto.username,
      passwordHash: 'argon2-test-hash',
    });

    expect(result).toEqual(userProfile);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('should reject an existing email', async () => {
    usersService.findByEmail.mockResolvedValue(userProfile);
    usersService.findByUsername.mockResolvedValue(null);

    await expect(service.register(dto)).rejects.toThrow(
      ConflictException,
    );

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(usersService.createUser).not.toHaveBeenCalled();
  });

  it('should reject an existing username', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByUsername.mockResolvedValue(userProfile);

    await expect(service.register(dto)).rejects.toThrow(
      ConflictException,
    );

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(usersService.createUser).not.toHaveBeenCalled();
  });
});