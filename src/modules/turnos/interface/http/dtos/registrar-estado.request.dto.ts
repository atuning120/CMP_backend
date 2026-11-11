import { IsOptional, IsString } from 'class-validator';

// Solo se decoran los textos con riesgo de 500 (ver IniciarTurnoRequestDto). Opcionales: si falta idCliente, el use
// case responde ID_CLIENTE_INVALIDO como siempre
export class RegistrarEstadoRequestDto {
  @IsOptional()
  @IsString()
  idCliente: string;
  idTurno?: number;
  @IsOptional()
  @IsString()
  idClienteTurno?: string;
  idEstado: number;
  inicio?: string;
  @IsOptional()
  @IsString()
  comentario?: string;
}
