import { IsOptional, IsString } from 'class-validator';

// Solo se valida el tipo: sin token, el use case responde TOKEN_INVALIDO
export class LoginWebRequestDto {
  @IsOptional()
  @IsString()
  entraIdToken: string;
}
