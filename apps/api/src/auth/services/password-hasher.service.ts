import {
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordHasherService implements OnModuleInit {
  private dummyPasswordHash: string | null = null;

    // Use a precomputed dummy hash when no stored password hash is available,
    // avoiding a fast path for unknown accounts. This reduces timing leaks
    // but does not guarantee constant-time execution for the entire login flow.
  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await argon2.hash(
      'dummy-password-for-unknown-accounts',
      {
        type: argon2.argon2id,
      },
    );
  }

  async hash(plaintextPassword: string): Promise<string> {
    return argon2.hash(plaintextPassword, {
      type: argon2.argon2id,
    });
  }

  async verify(
    plaintextPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    return argon2.verify(passwordHash, plaintextPassword);
  }

  async verifyOrDummy(
    plaintextPassword: string,
    passwordHash: string | null,
  ): Promise<boolean> {
    const hashToVerify = passwordHash ?? this.dummyPasswordHash;

    if (!hashToVerify) {
      throw new Error(
        'PasswordHasherService has not been initialized.',
      );
    }

    return this.verify(plaintextPassword, hashToVerify);
  }
}