import { ConflictException, UnauthorizedException } from '@nestjs/common';

import {
  UserProfile,
  UsersService,
} from '../users/users.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { PasswordHasherService } from './services/password-hasher.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { SessionRepository } from './repositories/session.repository';
import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

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
    verifyOrDummy: jest.Mock;
  };
  let refreshTokenService: { generateToken: jest.Mock; hashToken: jest.Mock };
  let sessionRepository: {
    revokeSession: jest.Mock;
    findRefreshTokenByHash: jest.Mock;
    rotateRefreshToken: jest.Mock;
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
      verifyOrDummy: jest.fn(),
    };

    refreshTokenService = {
      generateToken: jest.fn(),
      hashToken: jest.fn(),
    };

    sessionRepository = {
      revokeSession: jest.fn(),
      findRefreshTokenByHash: jest.fn(),
      rotateRefreshToken: jest.fn(),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      passwordHasher as unknown as PasswordHasherService,
      refreshTokenService as unknown as RefreshTokenService,
      sessionRepository as unknown as SessionRepository,
      {} as JwtService,
      {} as ConfigService,
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

  it('revokes the requested session using named identifiers', async () => {
    sessionRepository.revokeSession.mockResolvedValue(true);

    await service.logout('session-uuid', 'user-uuid');

    expect(sessionRepository.revokeSession).toHaveBeenCalledWith({
      sessionId: 'session-uuid',
      userId: 'user-uuid',
      now: expect.any(Date),
    });
  });

  it('does not report logout success when no matching session was updated', async () => {
    sessionRepository.revokeSession.mockResolvedValue(false);

    await expect(service.logout('session-uuid', 'user-uuid')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects refresh for a token whose session has been revoked', async () => {
    refreshTokenService.hashToken.mockReturnValue('stored-token-hash');
    sessionRepository.findRefreshTokenByHash.mockResolvedValue({
      id: 'refresh-token-id',
      sessionId: 'session-uuid',
      tokenExpiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      sessionExpiresAt: new Date(Date.now() + 120_000),
      sessionRevokedAt: new Date(),
      user: {
        id: 'user-uuid',
        email: 'user@example.com',
        username: 'user',
        accountStatus: 'ACTIVE',
      },
    });

    await expect(service.refresh('opaque-refresh-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(sessionRepository.rotateRefreshToken).not.toHaveBeenCalled();
  });
});
