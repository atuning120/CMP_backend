import { IsOptional, IsString } from 'class-validator';

// Solo se valida el tipo: los datos obligatorios y la contraseña los revisa el use case
export class RegisterAdminRequestDto {
  @IsOptional()
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  apellido: string;

  @IsOptional()
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  password: string;
}
