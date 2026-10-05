export const EVIDENCIA_REPOSITORY = Symbol('EVIDENCIA_REPOSITORY');

export interface EvidenciaRegistro {
  idEvidencia: number;
  idReporte: number;
  // Clave del archivo en el almacenamiento (columna url_blob)
  claveArchivo: string;
  fechaHora: Date;
  idCliente: string | null;
}

export interface EvidenciaRepositoryPort {
  findByIdCliente(idCliente: string): Promise<EvidenciaRegistro | null>;
  create(data: Omit<EvidenciaRegistro, 'idEvidencia'>): Promise<EvidenciaRegistro>;
}
