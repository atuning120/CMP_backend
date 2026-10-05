export class RegistrarEstadoRequestDto {
  idCliente: string;
  idTurno?: number;
  idClienteTurno?: string;
  idEstado: number;
  inicio?: string;
  comentario?: string;
}
