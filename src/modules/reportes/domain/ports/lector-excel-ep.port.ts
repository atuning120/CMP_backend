import type { RegistroEp } from '../repositories/carga-ep.repository.port';

export const LECTOR_EXCEL_EP = Symbol('LECTOR_EXCEL_EP');

export interface ErrorFilaEp {
  fila: number | null; // null: el problema es del archivo, no de una fila
  mensaje: string;
}

export interface LecturaExcelEp {
  registros: RegistroEp[];
  errores: ErrorFilaEp[];
}

// Lee solo la hoja "Base de datos" del EP: el resto del archivo (horas extra por trabajador, tarifas, montos) trae
// datos personales y comerciales y nunca se lee
export interface LectorExcelEpPort {
  // null si el contenido no es un .xlsx válido
  leer(contenido: Buffer): Promise<LecturaExcelEp | null>;
}
