import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';


const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginGuard implements CanActivate {
    private readonly allowedOrigins: string;

    constructor(
        configService: ConfigService
    ) {
        this.allowedOrigins = new URL(
            configService.getOrThrow<string>('WEB_ORIGIN'),
        ).origin;
    }


    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();

        if(SAFE_METHODS.has(request.method)){
            return true;
        }

        const origin = request.headers.origin;

        if(
            typeof origin !== 'string' ||
            origin !== this.allowedOrigins 
        ){
            throw new ForbiddenException(
                'Invalid request origin'
            );
        }

        return true;
    }
}