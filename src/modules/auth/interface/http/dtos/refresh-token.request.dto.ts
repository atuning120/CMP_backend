import { IsOptional, IsString } from 'class-validator';

// Opcional: el panel web lo manda en la cookie (o null, en sesiones guardadas antes de la cookie)
export class RefreshTokenRequestDto {
  @IsOptional()
  @IsString()
  refreshToken: string;
}
