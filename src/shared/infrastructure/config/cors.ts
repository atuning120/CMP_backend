import type { CorsOptions, CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';

// Content-Disposition: el panel web lee el nombre de los archivos que descarga (Excel)
const EXPUESTOS = ['Content-Disposition'];

/**
 * CORS del Backend. Solo los orígenes del panel web (WEB_ORIGENES, separados por coma) pueden enviar credenciales,
 * es decir, la cookie de sesión. El resto de la API usa el JWT en el header Authorization y se acepta desde
 * cualquier origen, como antes.
 */
export function opcionesCors(origenesWeb: string | undefined): CorsOptionsDelegate<{ headers: { origin?: string } }> {
  const permitidos = (origenesWeb || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return (req, callback) => {
    const origen = req.headers.origin;
    const opciones: CorsOptions =
      origen && permitidos.includes(origen)
        ? { origin: origen, credentials: true, exposedHeaders: EXPUESTOS }
        : { origin: '*', exposedHeaders: EXPUESTOS };
    callback(null, opciones);
  };
}
