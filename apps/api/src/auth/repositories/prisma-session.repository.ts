import { Injectable } from "@nestjs/common";
import { CreatedSession, CreateSessionInput, SessionRepository, RefreshTokenContext, RotateRefreshTokenInput, RotateRefreshTokenResult, ActiveSessionContext} from "./session.repository";
import { PrismaService } from "src/database/prisma.service";


@Injectable()
export class PrismaSessionRepository implements SessionRepository{
    constructor(
        private readonly prisma: PrismaService
    ){}

    async createWithRefreshToken(input: CreateSessionInput): Promise<CreatedSession> {
        // Atomic transaction to create a session and its associated refresh token
        return this.prisma.session.create({
            data: {
                userId: input.userId,
                expiresAt: input.sessionExpiresAt,
                refreshTokens: {
                    create: {
                        tokenHash: input.refreshTokenHash,
                        expiresAt: input.refreshTokenExpiresAt,
                    }
                }
            },
            select: {
                id: true,
                expiresAt: true,
            }
        });
    }

    async findRefreshTokenByHash(
        tokenHash: string,
    ): Promise<RefreshTokenContext | null> {
        const token =
            await this.prisma.sessionRefreshToken.findUnique({
            where: { tokenHash },
            include: {
                session: {
                include: {
                    user: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        accountStatus: true,
                    },
                    },
                },
                },
            },
            });

        if (!token) {
            return null;
        }

        return {
            id: token.id,
            sessionId: token.sessionId,
            tokenExpiresAt: token.expiresAt,
            consumedAt: token.consumedAt,
            sessionExpiresAt: token.session.expiresAt,
            sessionRevokedAt: token.session.revokedAt,
            user: token.session.user,
        };
        }


    async rotateRefreshToken(
        input: RotateRefreshTokenInput,
    ): Promise<RotateRefreshTokenResult> {
        return this.prisma.$transaction(async (tx) => {
            // CASE 1: Reject an unknown token hash.
            // This prevents random or forged refresh tokens from creating sessions.
            const token = await tx.sessionRefreshToken.findUnique({
            where: { tokenHash: input.currentTokenHash },
            include: {
                session: {
                include: {
                    user: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        accountStatus: true,
                    },
                    },
                },
                },
            },
            });

        if (!token) {
        return { status: 'INVALID' };
        }

        // CASE 2: Expired tokens are invalid regardless of whether they were
        // consumed. They must not revoke a session after their expiry.
        if (token.expiresAt <= input.now) {
            return { status: 'INVALID' };
        }

        // CASE 3: Detect reuse of an unexpired token consumed by an earlier rotation.
        // Return normally so the session revocation commits; throwing here
        // would roll back the revocation inside this transaction.
        if (token.consumedAt !== null) {
            await tx.session.updateMany({
                where: {
                id: token.sessionId,
                revokedAt: null,
                },
                data: {
                revokedAt: input.now,
                },
            });

            return { status: 'REUSED' };
        }

        // CASE 4: Refuse rotation if the session or account is invalid.
        // Also enforce that the replacement token never outlives its session.
        if (
            token.session.expiresAt <= input.now ||
            token.session.revokedAt !== null ||
            token.session.user.accountStatus !== 'ACTIVE' ||
            input.replacementExpiresAt <= input.now ||
            input.replacementExpiresAt > token.session.expiresAt
        ) {
             return { status: 'INVALID' };
        }

        // CASE 4: Conditionally touch the active session.
        // This locks the session row during the transaction and helps
        // serialize refresh operations with concurrent session revocation.
        const activeSession = await tx.session.updateMany({
            where: {
                id: token.sessionId,
                revokedAt: null,
                expiresAt: { gt: input.now },
            },
            data: {
                lastUsedAt: input.now,
            },
        });

        if (activeSession.count !== 1) {
            return { status: 'INVALID' };
        }

        // CASE 5: Atomically consume the current refresh token.
        // The consumedAt IS NULL condition ensures only one request can win.
        const consumed = await tx.sessionRefreshToken.updateMany({
            where: {
                id: token.id,
                consumedAt: null,
                expiresAt: { gt: input.now },
            },
            data: {
                consumedAt: input.now,
            },
        });

        if (consumed.count !== 1) {
            // CASE 6: Distinguish a concurrent replay from other failures.
            // Re-read after the conditional update; a competing transaction
            // may have consumed the token while this request was waiting.
            const latest = await tx.sessionRefreshToken.findUnique({
                where: { id: token.id },
                select: {
                    consumedAt: true,
                    expiresAt: true,
                },
            });

        if (
            latest?.consumedAt !== null &&
            latest?.consumedAt !== undefined &&
            latest.expiresAt > input.now
        ) {
            // CASE 7: A competing request consumed this same, unexpired token.
            // Revoke the session and return normally so revocation commits.
            await tx.session.updateMany({
            where: {
                id: token.sessionId,
                revokedAt: null,
            },
            data: {
                revokedAt: input.now,
            },
            });

            return { status: 'REUSED' };
        }

            // No confirmed replay: fail closed without issuing a replacement.
            return { status: 'INVALID' };
        }

        // CASE 8: Create the replacement only after consumption succeeds.
        // Both writes are in one transaction: if creation fails, consumption
        // rolls back too. The partial unique index enforces one live token.
        await tx.sessionRefreshToken.create({
        data: {
            sessionId: token.sessionId,
            tokenHash: input.replacementTokenHash,
            expiresAt: input.replacementExpiresAt,
        },
        });

        // CASE 9: Return the result required to issue the new access token.
        // The raw refresh token is never read from or stored in the database.
        return {
            status: 'ROTATED',
            sessionId: token.sessionId,
            sessionExpiresAt: token.session.expiresAt,
            user: token.session.user,
        };
    });
    }

    async revokeSessionForTokenReuse(
        sessionId: string,
        now: Date,
    ): Promise<void> {
        await this.prisma.session.updateMany({
            where: {
            id: sessionId,
            revokedAt: null,
            },
            data: {
            revokedAt: now,
            },
        });
    }

    async findActiveSession(
        sessionId: string,
        userId: string,
        now: Date,
    ): Promise<ActiveSessionContext | null> {
        const session = await this.prisma.session.findFirst({
            where: {
                id: sessionId,
                userId,
                revokedAt: null,
                expiresAt: { gt: now },
                
                user:{
                    is: {
                        accountStatus: 'ACTIVE'
                    }
                }

            },
            select: {
                id: true,
                userId: true,
                expiresAt: true,
                user: {
                    select: {
                        id: true,
                        accountStatus: true,
                    }
                }
            }
        });

        if(!session){
            return null;
        }

        return {
            id: session.id,
            userId: session.userId,
            expiresAt: session.expiresAt,
            user: {
                id: session.user.id,
                accountStatus: session.user.accountStatus,
            }
        }
    }
}
