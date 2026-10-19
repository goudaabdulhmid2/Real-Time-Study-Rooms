import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, IsStrongPassword, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
    @Transform(({value}) => typeof value === 'string' ? value.trim(): value)
    @IsEmail()
    @MaxLength(255)
    @IsNotEmpty()
    email!: string;

    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(30)
    @Matches(/^[a-zA-Z0-9_]+$/)
    username!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(128)
    @IsStrongPassword({
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
    })
    password!: string;

}