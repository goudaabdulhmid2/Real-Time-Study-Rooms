import type { UserRecord } from '../../users/repositories/user.repository';


export interface CreateSessionInput {
  userId: string;
  sessionExpiresAt: Date;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}

export interface CreatedSession {
  id: string;
  expiresAt: Date;
}

export type SessionUser = Pick<
  UserRecord,
  'id' | 'email' | 'username' | 'accountStatus'
>;

export interface RefreshTokenContext {
  id: string;
  sessionId: string;
  tokenExpiresAt: Date;
  consumedAt: Date | null;
  sessionExpiresAt: Date;
  sessionRevokedAt: Date | null;
  user: SessionUser;
}

export interface RotateRefreshTokenInput {
  currentTokenHash: string;
  replacementTokenHash: string;
  now: Date;
  replacementExpiresAt: Date;
}

export type RotateRefreshTokenResult =
  | {
      status: 'ROTATED';
      sessionId: string;
      sessionExpiresAt: Date;
      user: SessionUser;
    }
  | {
      status: 'REUSED' | 'INVALID';
    };
export abstract class SessionRepository {
  abstract createWithRefreshToken(
    input: CreateSessionInput,
  ): Promise<CreatedSession>;

  abstract findRefreshTokenByHash(
  tokenHash: string,
  ): Promise<RefreshTokenContext | null>;

  abstract rotateRefreshToken(
  input: RotateRefreshTokenInput,
  ): Promise<RotateRefreshTokenResult>;

  abstract revokeSessionForTokenReuse(
  sessionId: string,
  now: Date,
): Promise<void>;

}


