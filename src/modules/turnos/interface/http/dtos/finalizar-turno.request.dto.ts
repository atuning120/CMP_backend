import { IsOptional, IsString } from 'class-validator';

// Solo se decoran los textos con riesgo de 500 (ver IniciarTurnoRequestDto)
export class FinalizarTurnoRequestDto {
  idTurno?: number;
  @IsOptional()
  @IsString()
  idClienteTurno?: string;
  horometroFinal: number;
  fechaFin?: string;
}
