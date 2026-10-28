import { apiRequest } from "../../../lib/api-client";

export type RegisterRequest = {
    username: string;
    email: string;
    password: string;
}

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisteredUser = {
    id: string;
    email: string | null;
    username: string | null;
}

export type CurrentUser = {
  userId: string;
};

export const authApi = {
    register(input: RegisterRequest): Promise<RegisteredUser> {
        return apiRequest<RegisteredUser>('/auth/register', {
            method: 'POST',
            data: input,
        })
    },

    login(input: LoginRequest): Promise<RegisteredUser> {
        return apiRequest<RegisteredUser>('/auth/login', {
            method: 'POST',
            data: input,
        })
    },

    me(): Promise<CurrentUser> {
        return apiRequest<CurrentUser>('/auth/me')
    },

    logout(): Promise<unknown> {
        return apiRequest<unknown>('/auth/logout', {
            method: 'POST',
        });
    }
}