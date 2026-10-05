export const ALMACENAMIENTO_ARCHIVOS = Symbol('ALMACENAMIENTO_ARCHIVOS');

// Dónde se guardan las fotos. Hoy disco local; puede reemplazarse por S3/Azure Blob sin tocar los use cases.
export interface AlmacenamientoArchivosPort {
  guardar(clave: string, contenido: Buffer): Promise<void>;
  leer(clave: string): Promise<Buffer | null>;
}
