export const CARGA_EP_REPOSITORY = Symbol('CARGA_EP_REPOSITORY');

// Una fila de la hoja "Base de datos" del Excel del estado de pago (EP) del contratista
export interface RegistroEp {
  fila: number; // fila en el Excel, para rastrear un dato raro hasta el archivo
  idExcel: number | null; // columna "ID" del Excel
  equipo: string; // columna "N° Interno": código interno (MAQUINA.nombre)
  categoria: string | null; // columna "Equipo": Bulldozer, Cargador Frontal...
  codigoReport: string | null;
  fecha: string; // YYYY-MM-DD
  horaInicio: string | null; // HH:MM:SS
  horometroInicial: number | null;
  horometroFinal: number | null;
  horas: number; // columna "Diferencia"
  area: string | null; // texto del contratista: "Area 84", "Tacho", "Api. 3001"...
}

// Excel vigente de un mes (REPORTES.CARGA)
export interface CargaEp {
  idCarga: number;
  periodo: string; // YYYY-MM
  fechaDesde: string; // YYYY-MM-DD: rango que cubre el EP (p. ej. del 25-05 al 25-06)
  fechaHasta: string;
  archivo: string;
  filas: number;
  subidoPor: string; // nombre del usuario
  subidoEn: Date;
}

export interface NuevaCargaEp {
  periodo: string; // YYYY-MM
  fechaDesde: string;
  fechaHasta: string;
  archivo: string;
  hashSha256: string;
  idUsuario: number;
  registros: RegistroEp[];
}

export interface CargaEpRepositoryPort {
  // De la más reciente a la más antigua
  listarVigentes(): Promise<CargaEp[]>;
  buscarVigente(periodo: string): Promise<CargaEp | null>;
  // De los códigos recibidos, los que existen como máquina (comparados sin distinguir mayúsculas)
  equiposConocidos(codigos: string[]): Promise<string[]>;
  // En una transacción: deja la carga vigente del mes como reemplazada y guarda la nueva con sus filas. null si otra
  // carga del mismo mes se confirmó al mismo tiempo
  reemplazar(nueva: NuevaCargaEp): Promise<CargaEp | null>;
}
