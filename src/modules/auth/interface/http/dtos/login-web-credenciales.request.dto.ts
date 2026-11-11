import { IsOptional, IsString } from 'class-validator';

// Solo se valida el tipo: si faltan datos, el use case responde DATOS_INCOMPLETOS
export class LoginWebCredencialesRequestDto {
  @IsOptional()
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  password: string;
}
