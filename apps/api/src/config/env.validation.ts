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
})