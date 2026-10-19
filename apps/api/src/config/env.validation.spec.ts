import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const validEnvironment = {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/study_rooms',
  };

  it('should apply default values', () => {
    const { error, value } =
      envValidationSchema.validate(validEnvironment);

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3000);
  });

  it('should reject an invalid port', () => {
    const { error } = envValidationSchema.validate({
      ...validEnvironment,
      PORT: '70000',
    });

    expect(error).toBeDefined();
  });

  it('should reject a missing DATABASE_URL', () => {
    const { error } = envValidationSchema.validate({
      PORT: '3000',
    });

    expect(error).toBeDefined();
  });

  it('should reject an unsupported NODE_ENV', () => {
    const { error } = envValidationSchema.validate({
      ...validEnvironment,
      NODE_ENV: 'staging',
    });

    expect(error).toBeDefined();
  });
});