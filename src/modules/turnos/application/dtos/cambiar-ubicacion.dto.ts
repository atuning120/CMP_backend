export class CambiarUbicacionDto {
  idOperador: number;
  idTurno?: number | null;
  idClienteTurno?: string | null;
  idCliente: string;
  idArea: number;
  idZona: number | null;
  inicio?: string | Date | null;
}
