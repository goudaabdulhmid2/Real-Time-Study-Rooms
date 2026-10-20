import { Controller, HttpCode, Post, HttpStatus, Body, Res } from "@nestjs/common";
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { AuthService } from "./auth.service";
import { UserProfile } from "src/users/users.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from './dto/login.dto';
import {
  AUTH_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
} from './auth.constants';

@Controller({
    path: 'auth',
    version: '1',
})
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,

    ) {}

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() dto: RegisterDto): Promise<UserProfile> {
        return this.authService.register(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    ) {
    const result = await this.authService.login(dto);

    response.cookie(
        REFRESH_TOKEN_COOKIE,
        result.refreshToken,
        {
        httpOnly: true,
        secure:
            this.configService.getOrThrow<string>(
            'NODE_ENV',
            ) === 'production',
        sameSite: 'lax',
        path: AUTH_COOKIE_PATH,
        expires: result.refreshTokenExpiresAt,
        },
    );

    return {
        accessToken: result.accessToken,
        tokenType: 'Bearer',
        user: result.user,
    };
    }

}