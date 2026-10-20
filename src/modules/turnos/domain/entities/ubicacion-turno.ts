// Área (y opcionalmente zona de trabajo) donde se desarrolla el turno. Se registra en TURNO_UBICACION.
export interface UbicacionTurno {
  idArea: number;
  idZona: number | null;
}

// Un tramo del recorrido del turno: la ubicación inicial o un cambio informado por el operador
export interface UbicacionTurnoRegistro extends UbicacionTurno {
  idTurnoUbicacion: number;
  idTurno: number;
  inicio: Date;
  fin: Date | null;
  // UUID del cambio generado por la app; null en la ubicación con que se inició el turno
  idCliente: string | null;
}
