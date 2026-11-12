import type { PosicionDispositivo, PosicionMaquina, PuntoRecorrido } from '../entities/posicion-gps';

// Máquina y horario de un turno; fin null = sigue en curso
export interface PeriodoTurno {
  idMaquina: number;
  inicio: Date;
  fin: Date | null;
}

export const TRACKING_REPOSITORY = Symbol('TRACKING_REPOSITORY');

export interface TrackingRepositoryPort {
  /**
   * Guarda en TRACKING_HISTORY las posiciones de dispositivos registrados que estaban asignados a una máquina en
   * su fecha (ASIGNACION_GPS). El GPS virtual de la app móvil se registra solo con su primera posición. Las de IMEI
   * desconocido o sin asignación vigente se omiten, y una posición repetida (mismo dispositivo y fecha) no se duplica.
   * Devuelve las guardadas con su máquina.
   */
  guardar(posiciones: PosicionDispositivo[]): Promise<PosicionMaquina[]>;
  // Última posición de cada máquina desde esa fecha
  ultimasPorMaquina(desde: Date): Promise<PosicionMaquina[]>;
  // Posiciones de la máquina en [desde, hasta), de la más antigua a la más nueva, como máximo `limite`
  recorrido(idMaquina: number, desde: Date, hasta: Date, limite: number): Promise<PuntoRecorrido[]>;
  // null si el turno no existe
  periodoDeTurno(idTurno: number): Promise<PeriodoTurno | null>;
}
