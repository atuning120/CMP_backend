export const ALERTA_TURNO_REPOSITORY = Symbol('ALERTA_TURNO_REPOSITORY');

// Un turno que pasa estas horas abierto genera la alerta de turno extendido (a las 13 h se cierra solo)
export const HORAS_AVISO_TURNO_EXTENDIDO = 10;
// Turnos del mismo operador separados por menos de este descanso forman una sola jornada (p. ej. cambió de
// máquina porque la suya falló): la fatiga se mide por jornada, no por turno
export const HORAS_DESCANSO_ENTRE_JORNADAS = 8;

// Alertas de turno: se calculan desde TURNO (fuente de verdad), no se guardan aparte
// - TURNO_EXTENDIDO: el turno llegó a las 10 h (fecha = inicio + 10 h)
// - CIERRE_AUTOMATICO: el sistema lo cerró a las 13 h, probablemente porque el operador olvidó finalizarlo
// - JORNADA_EXTENDIDA: el operador sumó 10 h trabajadas en una jornada de varios turnos (fecha = el momento en que
//   las cruzó, dentro del turno en que pasó). Un turno solo que llega a 10 h ya es TURNO_EXTENDIDO
export type TipoAlertaTurno = 'TURNO_EXTENDIDO' | 'CIERRE_AUTOMATICO' | 'JORNADA_EXTENDIDA';

export interface AlertaTurno {
  id: string; // 'E-<id_turno>', 'A-<id_turno>' o 'J-<id_turno>': un turno puede tener varias
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
  // Solo JORNADA_EXTENDIDA: desde cuándo trabaja, en cuántos turnos y cuántas horas lleva (hasta el fin del turno
  // de la alerta, o hasta ahora si sigue en curso)
  jornada: { inicio: Date; turnos: number; horas: number } | null;
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
  // Operadores trabajando ahora que ya pasaron las horas de aviso, en su turno o sumando su jornada (contador)
  contarExtendidosEnCurso(): Promise<number>;
}
