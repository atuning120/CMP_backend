export const HISTORIAL_REPOSITORY = Symbol('HISTORIAL_REPOSITORY');

export type TipoEventoHistorial = 'INICIO_TURNO' | 'INCORPORAR' | 'EDITAR' | 'HABILITAR' | 'DESHABILITAR' | 'REEMPLAZAR';

// Un evento del historial del jefe de turno: una acción de la bitácora o un inicio de turno de un operador
export interface EventoHistorial {
  id: string; // 'B-<id_bitacora>' o 'T-<id_turno>': únicos aunque vengan de tablas distintas
  tipo: TipoEventoHistorial;
  fecha: Date;
  actor: string; // jefe de turno (bitácora) u operador (turno)
  maquina: { id: number; nombre: string };
  motivo: string | null;
  observacion: string | null;
  detalle: Record<string, unknown> | null;
}

export interface FiltroHistorial {
  incluirTurnos: boolean;
  incluirFlota: boolean;
  antesDe: Date | null; // paginación: eventos estrictamente anteriores a esta fecha
  limite: number;
}

export interface HistorialRepositoryPort {
  listar(filtro: FiltroHistorial): Promise<EventoHistorial[]>;
}
