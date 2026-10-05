export class FinalizarTurnoDto {
  idOperador: number;
  // Se identifica el turno por id del servidor o por el UUID con que lo creó la app
  idTurno?: number | null;
  idClienteTurno?: string | null;
  horometroFinal: number;
  fechaFin?: string | Date | null;
}
