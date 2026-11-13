/**
 * Evento interno (EventEmitter2, en el mismo proceso) que emiten los repositorios de turnos después de guardar un
 * inicio, un cierre (del operador, del jefe de turno o automático) o un cambio de estado operacional. Lo escucha
 * AlertasEnVivoScheduler para revisar las alertas al instante en vez de esperar su próxima revisión periódica.
 */
export const EVENTO_TURNOS_CAMBIARON = 'turnos.cambiaron';
