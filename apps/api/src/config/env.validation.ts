import * as Joi from 'joi';

export const envValidationSchema = Joi.object({

    // Application 
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),

    PORT: Joi.number()
        .integer()
        .min(1)
        .max(65535)
        .default(3000),

    // PostgreSQL Database
    DATABASE_URL: Joi.string()
        .trim()
        .min(1)
        .required(),

    WEB_ORIGIN: Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .default('http://localhost:5173'),

    JWT_ACCESS_SECRET: Joi.string()
        .min(32)
        .required(),

    JWT_ACCESS_EXPIRES_IN: Joi.string()
        .pattern(/^[1-9]\d*[smhd]$/)
        .default('15m'),

    SESSION_MAX_AGE_DAYS: Joi.number()
        .integer()
        .min(1)
        .max(90)
        .default(30),

    REFRESH_TOKEN_TTL_DAYS: Joi.number()
        .integer()
        .min(1)
        .max(30)
        .default(7),
        
})