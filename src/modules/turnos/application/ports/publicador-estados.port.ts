import type { CategoriaEstado } from '../../domain/repositories/turno-estado.repository.port';

export const PUBLICADOR_ESTADOS = Symbol('PUBLICADOR_ESTADOS');

// Estado operacional vigente del turno en curso de una máquina (el mapa del panel web pinta la máquina con su categoría)
export interface EstadoOperacionalVigente {
  idEstado: number;
  nombre: string;
  categoria: CategoriaEstado | null;
  desde: Date;
}

export interface CambioEstadoMaquina {
  idMaquina: number;
  idTurno: number;
  estadoOperacional: EstadoOperacionalVigente;
}

// Avisa en tiempo real cuando una máquina cambia de estado operacional (el panel web lo recibe por WebSocket)
export interface PublicadorEstadosPort {
  publicar(cambio: CambioEstadoMaquina): void;
}
