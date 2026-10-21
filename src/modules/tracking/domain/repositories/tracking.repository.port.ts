import type { PosicionDispositivo, PosicionMaquina } from '../entities/posicion-gps';

export const TRACKING_REPOSITORY = Symbol('TRACKING_REPOSITORY');

export interface TrackingRepositoryPort {
  /**
   * Guarda en TRACKING_HISTORY las posiciones de dispositivos registrados que estaban asignados a una máquina en
   * su fecha (ASIGNACION_GPS). Las de IMEI desconocido o sin asignación vigente se omiten, y una posición repetida
   * (mismo dispositivo y fecha) no se duplica. Devuelve las guardadas con su máquina.
   */
  guardar(posiciones: PosicionDispositivo[]): Promise<PosicionMaquina[]>;
  // Última posición de cada máquina desde esa fecha
  ultimasPorMaquina(desde: Date): Promise<PosicionMaquina[]>;
}
