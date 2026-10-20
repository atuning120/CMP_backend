export class CambiarUbicacionRequestDto {
  idCliente: string;
  idTurno?: number;
  idClienteTurno?: string;
  idArea: number;
  idZona?: number | null;
  // Momento real del cambio (ISO 8601); puede llegar tarde si se registró sin conexión
  inicio?: string;
}
