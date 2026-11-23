export const VERSION_APP_REPOSITORY = Symbol('VERSION_APP_REPOSITORY');

export interface VersionApp {
  idVersion: number;
  version: string;
  notas: string;
  // Nombre del blob en el contenedor de APKs
  archivo: string;
  tamanoBytes: number;
  // false: retirada, no aparece en la página pública ni se puede descargar
  publicada: boolean;
  subidaEn: Date;
  // Nombre de quien la subió (null si su cuenta ya no existe)
  subidaPor: string | null;
}

// Tabla VERSION_APP (migración 023)
export interface VersionAppRepositoryPort {
  // De la versión más alta a la más baja
  listar(soloPublicadas: boolean): Promise<VersionApp[]>;
  buscar(idVersion: number): Promise<VersionApp | null>;
  existeVersion(version: string): Promise<boolean>;
  // null si ese número de versión ya existe (otra subida al mismo tiempo)
  crear(datos: { version: string; notas: string; archivo: string; tamanoBytes: number; idUsuario: number }): Promise<VersionApp | null>;
  // null si no existe
  actualizar(idVersion: number, cambios: { notas?: string; publicada?: boolean }): Promise<VersionApp | null>;
  // La fila borrada, o null si no existía
  eliminar(idVersion: number): Promise<VersionApp | null>;
}
