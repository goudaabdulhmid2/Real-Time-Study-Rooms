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

export abstract class SessionRepository {
  abstract createWithRefreshToken(
    input: CreateSessionInput,
  ): Promise<CreatedSession>;
}