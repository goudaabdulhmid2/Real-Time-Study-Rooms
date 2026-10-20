import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import type { AuthUser } from '../interfaces/auth-user.interface';
import { SessionRepository } from '../repositories/session.repository';

interface JwtPayload {
  sub?: unknown;
  sid?: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly sessionRepository: SessionRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          const token = request.cookies?.access_token;
          return typeof token === 'string' ? token : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>(
        'JWT_ACCESS_SECRET',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      typeof payload.sid !== 'string' ||
      payload.sid.length === 0
    ) {
      throw new UnauthorizedException('Invalid access token.');
    }

    const session = await this.sessionRepository.findActiveSession(
      payload.sid,
      payload.sub,
      new Date(),
    );

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session.');
    }

    return {
      userId: session.user.id,
      sessionId: session.id,
    };
  }
}