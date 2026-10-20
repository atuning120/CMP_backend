import type { EventoHistorial, TurnoConciliacion } from '../repositories/historial.repository.port';

export const HISTORIAL_EXCEL = Symbol('HISTORIAL_EXCEL');

export interface DatosExcelHistorial {
  tipo: 'TODO' | 'TURNOS' | 'FLOTA';
  desde: Date;
  hasta: Date; // exclusiva
  generado: Date;
  zonaHoraria: string; // IANA: las fechas del archivo se escriben en la hora local de quien lo descarga
}

// Lo que va al archivo, del más antiguo al más reciente. Sin turnos (tipo FLOTA) o sin movimientos (tipo TURNOS)
// se omiten sus hojas
export interface ContenidoExcelHistorial {
  turnos: TurnoConciliacion[];
  movimientos: EventoHistorial[];
}

// Arma el .xlsx del historial: turnos para conciliar con la contratista, resumen por equipo y movimientos de flota
export interface HistorialExcelPort {
  generar(contenido: ContenidoExcelHistorial, datos: DatosExcelHistorial): Promise<Buffer>;
}
