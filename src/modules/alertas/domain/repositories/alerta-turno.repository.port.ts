export const ALERTA_TURNO_REPOSITORY = Symbol('ALERTA_TURNO_REPOSITORY');

// Un turno que pasa estas horas abierto genera la alerta de turno extendido (a las 12 h se cierra solo)
export const HORAS_AVISO_TURNO_EXTENDIDO = 10;

// Alertas de turno: se calculan desde TURNO (fuente de verdad), no se guardan aparte
// - TURNO_EXTENDIDO: el turno llegó a las 10 h (fecha = inicio + 10 h)
// - CIERRE_AUTOMATICO: el sistema lo cerró a las 12 h, probablemente porque el operador olvidó finalizarlo
export type TipoAlertaTurno = 'TURNO_EXTENDIDO' | 'CIERRE_AUTOMATICO';

export interface AlertaTurno {
  id: string; // 'E-<id_turno>' o 'A-<id_turno>': un turno puede tener ambas
  tipo: TipoAlertaTurno;
  fecha: Date;
  operador: string;
  maquina: { id: number; nombre: string };
  turno: {
    id: number;
    estado: string; // EN_CURSO: la alerta de turno extendido sigue activa
    horaInicio: Date;
    horaTermino: Date | null;
    horometroInicial: number | null;
    horometroFinal: number | null;
  };
  // Última ubicación registrada del turno
  area: string | null;
  zona: string | null;
}

export interface CursorAlerta {
  fecha: Date;
  id: string;
}

export interface FiltroAlertas {
  incluirExtendidos: boolean;
  incluirCierresAutomaticos: boolean;
  desde: Date; // inclusive
  hasta: Date | null; // exclusiva; null = hasta ahora
  despuesDe: CursorAlerta | null; // paginación: alertas que van después de esta en el orden descendente
  limite: number;
}

export interface AlertaTurnoRepositoryPort {
  listar(filtro: FiltroAlertas): Promise<AlertaTurno[]>;
  // Turnos en curso que ya pasaron las horas de aviso (para el contador de la pestaña)
  contarExtendidosEnCurso(): Promise<number>;
}
