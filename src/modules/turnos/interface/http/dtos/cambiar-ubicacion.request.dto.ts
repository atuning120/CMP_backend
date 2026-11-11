import { IsOptional, IsString } from 'class-validator';

// Solo se decoran los textos con riesgo de 500 (ver IniciarTurnoRequestDto). Opcionales: si falta idCliente, el use
// case responde ID_CLIENTE_INVALIDO como siempre
export class CambiarUbicacionRequestDto {
  @IsOptional()
  @IsString()
  idCliente: string;
  idTurno?: number;
  @IsOptional()
  @IsString()
  idClienteTurno?: string;
  idArea: number;
  idZona?: number | null;
  // Momento real del cambio (ISO 8601); puede llegar tarde si se registró sin conexión
  inicio?: string;
}
