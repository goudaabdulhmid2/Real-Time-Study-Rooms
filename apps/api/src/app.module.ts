import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; 
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'; 
import {RedisModule,  RedisToken} from '@nestjs-redis/client';
import { RedisThrottlerStorage } from '@nestjs-redis/throttler-storage';
import type { RedisClientType } from 'redis';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { GlobalResponseInterceptor } from './common/interceptors/global-response.interceptor';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OriginGuard } from './common/guards/origin.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
    }),

    RedisModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        options: {
          url: configService.getOrThrow<string>('REDIS_URL'),
        },
      }),
    }),

    ThrottlerModule.forRootAsync({ 
      imports: [ConfigModule],
      inject: [ConfigService, RedisToken()],
      useFactory: (
        configService: ConfigService,
        redis: RedisClientType
      ) => ({
        throttlers: [
          {
            ttl: configService.getOrThrow<number>('THROTTLE_TTL'),
            limit: configService.getOrThrow<number>('THROTTLE_LIMIT'),
          }
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: GlobalResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}