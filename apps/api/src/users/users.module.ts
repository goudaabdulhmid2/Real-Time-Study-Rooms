import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { PrismaUserRepository } from './repositories/prisma-user.repository';
import { UserRepository } from './repositories/user.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: UserRepository,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [UserRepository],
})
export class UsersModule {}