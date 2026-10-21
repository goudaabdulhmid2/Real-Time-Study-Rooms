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

export type RegisterUser = {
    id: string;
    email: string | null;
    username: string | null;
}


export const authApi = {
    register(input: RegisterRequest): Promise<RegisterUser> {
        return apiRequest<RegisterUser>('/auth/register', {
            method: 'POST',
            data: input,
        })
    },

    login(input: LoginRequest): Promise<RegisterUser> {
        return apiRequest<RegisterUser>('/auth/login', {
            method: 'POST',
            data: input,
        })
    }
}