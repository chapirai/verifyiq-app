import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsUUID()
  tenantId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @IsIn(['admin', 'compliance', 'reviewer', 'analyst'])
  role!: 'admin' | 'compliance' | 'reviewer' | 'analyst';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
