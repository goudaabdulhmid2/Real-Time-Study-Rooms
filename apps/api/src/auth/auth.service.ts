import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import {
  UserProfile,
  UsersService,
} from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { PasswordHasherService } from './services/password-hasher.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { SessionRepository } from './repositories/session.repository';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly sessionRepository: SessionRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<UserProfile> {
    const [existingEmail, existingUsername] = await Promise.all([
      this.usersService.findByEmail(dto.email),
      this.usersService.findByUsername(dto.username),
    ]);

    if (existingEmail || existingUsername) {
      throw new ConflictException(
        'A resource with these details already exists.',
      );
    }

    const passwordHash = await this.passwordHasher.hash(
      dto.password,
    );

    return this.usersService.createUser({
      email: dto.email,
      username: dto.username,
      passwordHash,
    });
  }

 async login(dto: LoginDto) {
    const user =
        await this.usersService.findForAuthenticationByEmail(
        dto.email,
        );

    const passwordMatches =
        user?.passwordHash
        ? await this.passwordHasher.verify(
            dto.password,
            user.passwordHash,
            )
        : false;

    if (
        !user ||
        user.accountStatus !== 'ACTIVE' ||
        !user.passwordHash ||
        !passwordMatches
    ) {
        throw new UnauthorizedException(
        'Invalid email or password.',
        );
    }

    const refreshToken =
        this.refreshTokenService.generateToken();

    const refreshTokenHash =
        this.refreshTokenService.hashToken(refreshToken);

    const refreshTtlDays =
        this.configService.getOrThrow<number>(
        'REFRESH_TOKEN_TTL_DAYS',
        );

    const sessionExpiresAt = new Date(
        Date.now() +
        refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    const session =
        await this.sessionRepository.createWithRefreshToken({
        userId: user.id,
        sessionExpiresAt,
        refreshTokenHash,
        refreshTokenExpiresAt: sessionExpiresAt,
        });

    const accessToken = await this.jwtService.signAsync({
        sub: user.id,
        sid: session.id,
    });

    return {
        accessToken,
        refreshToken,
        sessionExpiresAt: session.expiresAt,
        user: {
        id: user.id,
        email: user.email,
        username: user.username,
        accountStatus: user.accountStatus,
        },
    };
}

}