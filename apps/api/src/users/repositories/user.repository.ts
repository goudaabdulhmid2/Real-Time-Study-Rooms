export type UserAccountStatus =
  | 'ACTIVE'
  | 'DEACTIVATED'
  | 'ANONYMIZED';

export interface UserRecord {
    id: string;
    email: string | null;
    username: string | null;
    passwordHash: string | null;
    accountStatus: UserAccountStatus;
}

export interface CreateUserData {
    email: string;
    username: string;
    passwordHash: string;
}


export abstract class UserRepository {
    abstract findByEmail(
        normalizedEmail: string,
    ): Promise<UserRecord | null>;

    abstract findByUsername(
        normalizedUsername: string,
    ): Promise<UserRecord | null>;

    abstract findById(id: string): Promise<UserRecord | null>;

    abstract create(
        data: CreateUserData,
    ) : Promise<UserRecord>;
}