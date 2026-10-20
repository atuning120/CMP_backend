export const HISTORIAL_REPOSITORY = Symbol('HISTORIAL_REPOSITORY');

export type TipoEventoHistorial =
  | 'INICIO_TURNO'
  | 'INCORPORAR'
  | 'EDITAR'
  | 'HABILITAR'
  | 'DESHABILITAR'
  | 'CAMBIAR_ESTADO'
  | 'REEMPLAZAR'
  | 'DEVOLVER';

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

// Un turno con todo lo que se concilia contra el reporte mensual de la contratista (horómetros, equipo, áreas)
export interface TurnoConciliacion {
  idTurno: number;
  horaInicio: Date;
  horaTermino: Date | null;
  estado: string; // EN_CURSO | CERRADO | CERRADO_AUTO
  horometroInicial: number;
  horometroFinal: number | null;
  equipo: { codigo: string; patente: string | null; numeroChasis: string | null; tipo: string | null; esContratista: boolean };
  operador: string;
  ubicaciones: { area: string; zona: string | null }[]; // en el orden en que se recorrieron
  conflicto: string | null; // detalle si se aceptó pese a chocar con otro turno
  cerradoPor: string | null; // jefe de turno que lo cerró en nombre del operador
  motivoCierre: string | null;
}

export interface FiltroTurnosConciliacion {
  desde: Date; // inclusive, por hora de inicio
  hasta: Date; // exclusiva
  limite: number;
}

export interface HistorialRepositoryPort {
  listar(filtro: FiltroHistorial): Promise<EventoHistorial[]>;
  // Del más antiguo al más reciente
  listarTurnos(filtro: FiltroTurnosConciliacion): Promise<TurnoConciliacion[]>;
}
