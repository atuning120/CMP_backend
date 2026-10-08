export const HISTORIAL_REPOSITORY = Symbol('HISTORIAL_REPOSITORY');

export type TipoEventoHistorial = 'INICIO_TURNO' | 'INCORPORAR' | 'EDITAR' | 'HABILITAR' | 'DESHABILITAR' | 'REEMPLAZAR';

// Un evento del historial del jefe de turno: una acción de la bitácora o un turno de un operador (inicio y, si ya cerró, su fin)
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

// Posición del último evento recibido. Se ordena por (fecha, id) y no solo por fecha:
// dos eventos con la misma fecha en el corte de una página no deben perderse ni repetirse
export interface CursorHistorial {
  fecha: Date;
  id: string;
}

export interface FiltroHistorial {
  incluirTurnos: boolean;
  incluirFlota: boolean;
  desde: Date; // inclusive
  hasta: Date | null; // exclusiva; null = hasta ahora
  despuesDe: CursorHistorial | null; // paginación: eventos que van después de este en el orden descendente
  limite: number;
}

export interface HistorialRepositoryPort {
  listar(filtro: FiltroHistorial): Promise<EventoHistorial[]>;
}
