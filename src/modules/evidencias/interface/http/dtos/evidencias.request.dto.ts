export class CrearReporteRequestDto {
  idCliente: string;
  idTurno?: number;
  idClienteTurno?: string;
  tipo: string;
  descripcion?: string;
  fechaHora?: string;
}

export class SubirEvidenciaRequestDto {
  idCliente: string;
  idClienteReporte: string;
  fechaHora?: string;
}
