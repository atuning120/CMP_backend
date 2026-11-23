import type { RegistroEp, TarifaEp } from '../repositories/carga-ep.repository.port';

export const LECTOR_EXCEL_EP = Symbol('LECTOR_EXCEL_EP');

export interface ErrorFilaEp {
  fila: number | null; // null: el problema es del archivo, no de una fila
  mensaje: string;
}

export interface LecturaExcelEp {
  registros: RegistroEp[];
  tarifas: TarifaEp[];
  errores: ErrorFilaEp[];
}

// Lee la hoja "Base de datos" del EP y, de la hoja "EP #NN MLC" (el número cambia con cada EP), solo las tablas
// "Tarifas garantizadas" y "Tarifas diferenciadas". El resto del archivo (horas extra por trabajador, firmas, otros
// montos) trae datos personales y nunca se lee
export interface LectorExcelEpPort {
  // null si el contenido no es un .xlsx válido
  leer(contenido: Buffer): Promise<LecturaExcelEp | null>;
}
