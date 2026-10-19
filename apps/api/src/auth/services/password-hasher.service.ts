import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

@Injectable()
export class PasswordHasherService {
    async hash(plaintextPassword: string): Promise<string> {
        return argon2.hash(plaintextPassword,{
            type: argon2.argon2id,
        });
    }

    async verify(passwordHash: string, plaintextPassword: string): Promise<boolean> {
        return argon2.verify(passwordHash, plaintextPassword);
    }
}