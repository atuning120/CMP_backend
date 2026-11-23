// Versión de la app como la escribe el administrador: tres números, "1.4.0" (el mismo `version` de app.json)
const FORMATO_VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

export const esVersionValida = (version: unknown): version is string => typeof version === 'string' && FORMATO_VERSION.test(version);

// Orden numérico, no de texto: 1.10.0 va después de 1.9.0. Negativo si a < b
export const compararVersiones = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
};

// Nombre con que se guarda el archivo descargado
export const nombreDescarga = (version: string) => `geoplanta-movil-${version}.apk`;
