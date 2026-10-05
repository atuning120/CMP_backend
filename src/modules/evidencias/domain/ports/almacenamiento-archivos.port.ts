export const ALMACENAMIENTO_ARCHIVOS = Symbol('ALMACENAMIENTO_ARCHIVOS');

// Dónde se guardan las fotos: Azure Blob Storage si está configurado, si no disco local (desarrollo).
export interface AlmacenamientoArchivosPort {
  guardar(clave: string, contenido: Buffer, mimeType: string): Promise<void>;
  leer(clave: string): Promise<Buffer | null>;
}
