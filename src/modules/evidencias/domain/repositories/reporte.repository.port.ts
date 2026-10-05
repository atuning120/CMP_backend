export const REPORTE_REPOSITORY = Symbol('REPORTE_REPOSITORY');

export type TipoReporte = 'INICIO' | 'FIN' | 'NOVEDAD';

export interface ReporteRegistro {
  idReporte: number;
  idTurno: number;
  tipo: TipoReporte;
  descripcion: string | null;
  fechaHora: Date;
  idCliente: string | null;
}

export interface ReporteRepositoryPort {
  findById(idReporte: number): Promise<ReporteRegistro | null>;
  findByIdCliente(idCliente: string): Promise<ReporteRegistro | null>;
  create(data: Omit<ReporteRegistro, 'idReporte'>): Promise<ReporteRegistro>;
}
