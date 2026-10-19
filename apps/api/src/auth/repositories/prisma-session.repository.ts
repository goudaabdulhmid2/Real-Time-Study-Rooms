import { Injectable } from "@nestjs/common";''
import { CreatedSession, CreateSessionInput, SessionRepository } from "./session.repository";
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
}