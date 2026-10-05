export class RegistrarEstadoDto {
  idOperador: number;
  idTurno?: number | null;
  idClienteTurno?: string | null;
  idCliente: string;
  idEstado: number;
  inicio?: string | Date | null;
  comentario?: string | null;
}
