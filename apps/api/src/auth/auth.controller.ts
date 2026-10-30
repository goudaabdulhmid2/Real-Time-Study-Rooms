import { Controller, HttpCode, Post, HttpStatus, Body, Res, Req, UnauthorizedException, Get, UseGuards, Logger } from "@nestjs/common";
import { ConfigService } from '@nestjs/config';
import type { Response,Request } from 'express';

import { AuthService } from "./auth.service";
import { UserProfile } from "src/users/users.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from './dto/login.dto';
import {
  AUTH_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
} from './auth.constants';
import { getPresentedRefreshToken } from './refresh-cookie';
import { AuthUser } from "./interfaces/auth-user.interface";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { Throttle } from "@nestjs/throttler";

interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
@Controller({
    path: 'auth',
    version: '1',
})
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,

    ) {}

    @Throttle({default:{limit: 5, ttl: 60_000}})
    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() dto: RegisterDto): Promise<UserProfile> {
        return this.authService.register(dto);
    }

    @Throttle({default:{limit: 5, ttl: 60_000}})
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    ) {
    const result = await this.authService.login(dto);

    this.setAuthCookies(response, result);

    return {
        user: result.user,
    };
    }

    @Throttle({default:{limit: 10, ttl: 60_000}})
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ){
        const presentedToken = getPresentedRefreshToken(
            request.cookies,
            REFRESH_TOKEN_COOKIE,
        );

        const hasRefreshCookie =
            typeof presentedToken === 'string' && presentedToken.length > 0;
        this.logger.log(`Refresh request received; cookiePresent=${hasRefreshCookie}`);
        
        if(
            typeof presentedToken !== 'string' ||
            presentedToken.length === 0
        ){
            this.logger.warn('Refresh request rejected: cookie_missing_or_unparsed');
            this.ClearAuthCookies(response);

            throw new UnauthorizedException(
                'Invalid or expired session'
            )
        }

        try{
            const result = 
                await this.authService.refresh(presentedToken);

                this.setAuthCookies(response, result);

                return {
                    user: result.user
                }
        }catch(error: unknown){
            if(error instanceof UnauthorizedException){
                this.logger.warn('Refresh request rejected by AuthService');
                this.ClearAuthCookies(response)
            }

            throw error;
        }
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    async logout(
        @Req() request: AuthenticatedRequest,
        @Res({ passthrough: true }) response: Response,
    ) {
        await this.authService.logout(
            request.user.sessionId,
            request.user.userId,
        );

        this.ClearAuthCookies(response);

        return {
            message: 'Logged out successfully',
        }
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getMe(@Req() request: AuthenticatedRequest) {
        return {
            userId: request.user.userId,
        };
    }


    private setAuthCookies(
        response: Response,
        result: {
            accessToken: string;
            refreshToken: string;
            accessTokenExpiresAt: Date;
            refreshTokenExpiresAt: Date;
        }
    ): void {
        const secure = this.configService.get<string>('NODE_ENV') === 'production';

        response.cookie('access_token', result.accessToken, {
            httpOnly: true,
            secure,
            sameSite: 'lax',
            path: '/api/v1',
            expires: result.accessTokenExpiresAt,
        });

        response.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
            httpOnly: true,
            secure,
            sameSite: 'lax',
            path: AUTH_COOKIE_PATH,
            expires: result.refreshTokenExpiresAt,
        });
    }

    private ClearAuthCookies(response: Response): void {
        const secure = this.configService.get<string>('NODE_ENV') === 'production';

        response.clearCookie('access_token',{
            httpOnly: true,
            secure,
            sameSite: 'lax',
            path: '/api/v1',
        });

        response.clearCookie('refresh_token',{
            httpOnly: true,
            secure,
            sameSite: 'lax',
            path: AUTH_COOKIE_PATH,
        });
    }

}
