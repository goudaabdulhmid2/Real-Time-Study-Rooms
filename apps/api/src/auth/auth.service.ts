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

        const now = new Date();
        const sessionExpiresAt = this.calculateSessionExpiresAt(now);
        const refreshTokenExpiresAt = this.calculateRefreshTokenExpiresAt(
            now,
            sessionExpiresAt,
        );

        const accessTokenExpiresAt = 
            this.calculateAccessTokenExpiresAt(now)

        const session =
            await this.sessionRepository.createWithRefreshToken({
            userId: user.id,
            sessionExpiresAt,
            refreshTokenHash,
            refreshTokenExpiresAt,
            });

        const accessToken = await this.jwtService.signAsync({
            sub: user.id,
            sid: session.id,
        });

        return {
            accessToken,
            refreshToken,
            accessTokenExpiresAt,
            refreshTokenExpiresAt,
            sessionExpiresAt: session.expiresAt,
            user: {
            id: user.id,
            email: user.email,
            username: user.username,
            accountStatus: user.accountStatus,
            },
        };
    }
    
    async refresh(
        presentedToken: string
    ) {
        const now = new Date()

        // Case 1: Find the refresh token by its hash, never by storing raw tokens.
        const currentTokenHash = 
            this.refreshTokenService.hashToken(presentedToken);
        
        const currentToken = 
            await this.sessionRepository.findRefreshTokenByHash(
                currentTokenHash
            );
        
        // Case 2: Reject unknown tokens.
        if(!currentToken){
            throw new UnauthorizedException(
                'Invalid or expired session.'
            )
        }

        // Case 3: Expired tokens are invalid regardless of whether they were
        // consumed. Expired-token retries must not revoke an active session.
        if(currentToken.tokenExpiresAt <= now){
            throw new UnauthorizedException(
                'Invalid or expired session.'
            )
        }

        // Case 4: Detect reuse of an unexpired token already consumed by a
        // previous rotation. Revoke the session before rejecting the request.
        if(currentToken.consumedAt !== null){
            await this.sessionRepository.revokeSessionForTokenReuse(
                currentToken.sessionId,
                now
            );

            throw new UnauthorizedException(
                'Invalid or expired session.'
            )
        }

        // Case 5: Reject expired/revoked sessions and accounts that are no
        // longer active.
        if(
            currentToken.sessionExpiresAt <= now ||
            currentToken.sessionRevokedAt !== null ||
            currentToken.user.accountStatus !== 'ACTIVE'
        ){
            throw new UnauthorizedException(
                'Invalid or expired session.'
            )
        }

        // Case 5: Generate a new random refresh token and keep only its hash in the DB.
        const replacementToken = 
            this.refreshTokenService.generateToken();
        
        const replacementTokenHash = 
            this.refreshTokenService.hashToken(replacementToken);


        // Case 6: The new refresh token must not outlive the existing session.
    
        const replacementExpiresAt = 
            this.calculateRefreshTokenExpiresAt(
                now,
                currentToken.sessionExpiresAt
            );
        
        if(replacementExpiresAt <= now){
            throw new UnauthorizedException(
                'Invalid or expired session.'
            )
        }

        // Case 7: Calculate the new access cookie expiry using the configured TTL.
        const accessTokenExpiresAt = 
            this.calculateAccessTokenExpiresAt(now);

        // Case 8: Sign the access token before rotating the refresh token.
       // If signing fails, the current refresh token has not been consumed.
       const accessToken = await this.jwtService.signAsync({
            sub: currentToken.user.id,
            sid: currentToken.sessionId
       });

       // Case 9: Atomically consume the old token and create the replacement.
       const rotation = 
        await this.sessionRepository.rotateRefreshToken({
            currentTokenHash,
            replacementTokenHash,
            now,
            replacementExpiresAt
        })

        // The repository commits session revocation before returning REUSED.
        if(rotation.status !== 'ROTATED'){
            throw new UnauthorizedException(
                'Invalid or expired session'
            )
        }

        // Case 10: Return tokens for the controller to set as HttpOnly cookies.
        // These raw tokens must not be included in the JSON response.
        return {
            accessToken,
            refreshToken: replacementToken,
            accessTokenExpiresAt,
            refreshTokenExpiresAt: replacementExpiresAt,
            sessionExpiresAt: rotation.sessionExpiresAt,
            user: rotation.user
        }
        
        
            
        
    }

    private calculateSessionExpiresAt(now: Date): Date {
        const sessionMaxAgeDays =
            this.configService.getOrThrow<number>(
            'SESSION_MAX_AGE_DAYS',
            );

        const millisecondsPerDay = 24 * 60 * 60 * 1000;

        return new Date(
            now.getTime() +
            sessionMaxAgeDays * millisecondsPerDay,
        );
    }

    private calculateRefreshTokenExpiresAt(
        now: Date,
        sessionExpiresAt: Date,
    ): Date {
        const refreshTokenTtlDays =
            this.configService.getOrThrow<number>(
            'REFRESH_TOKEN_TTL_DAYS',
            );

        const millisecondsPerDay = 24 * 60 * 60 * 1000;

        const refreshTokenExpiresAt = new Date(
            now.getTime() +
            refreshTokenTtlDays * millisecondsPerDay,
        );

        return new Date(
            Math.min(
            refreshTokenExpiresAt.getTime(),
            sessionExpiresAt.getTime(),
            ),
        );
    }

    private calculateAccessTokenExpiresAt(now: Date): Date {
        const ttlSeconds = 
            this.configService.getOrThrow<number>("JWT_ACCESS_TTL_SECONDS");

        return new Date(
            now.getTime() + ttlSeconds * 1000
        );
    }

}
