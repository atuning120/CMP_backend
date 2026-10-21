import type { PosicionMaquina } from '../../domain/entities/posicion-gps';

export const PUBLICADOR_POSICIONES = Symbol('PUBLICADOR_POSICIONES');

// Avisa en tiempo real de las posiciones nuevas (el panel web las recibe por WebSocket)
export interface PublicadorPosicionesPort {
  publicar(posiciones: PosicionMaquina[]): void;
}
