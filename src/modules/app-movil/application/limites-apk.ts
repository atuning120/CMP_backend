import { appMovilError } from './app-movil.errors';

// Una APK de Expo pesa ~80 MB: el tope deja holgura sin aceptar cualquier cosa
export const TAMANO_MAXIMO_APK = 300 * 1024 * 1024;
export const MAXIMO_NOTAS = 2000;

// El enlace de descarga se pide al tocar el botón: basta con pocos minutos
export const VIGENCIA_DESCARGA_MS = 10 * 60 * 1000;
// Subir ~80 MB con mala señal puede tardar: el enlace de subida dura más
export const VIGENCIA_SUBIDA_MS = 30 * 60 * 1000;

// Todo archivo .apk es un ZIP: empieza con "PK\x03\x04"
export const CABECERA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export const exigirAdmin = (rol: string | undefined) => {
  if (rol !== 'ADMIN') throw appMovilError('SIN_PERMISO');
};

// Nombre del blob de una subida: la versión más un sufijo al azar, así nadie puede adivinarlo ni pisar uno existente
export const archivoDeSubida = (version: string, sufijo: string) => `geoplanta-movil-${version}-${sufijo}.apk`;
export const esArchivoDeSubida = (archivo: unknown, version: string): archivo is string =>
  typeof archivo === 'string' && new RegExp(`^geoplanta-movil-${version.replace(/\./g, '\\.')}-[0-9a-f]{8}\\.apk$`).test(archivo);
