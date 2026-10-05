import { turnoError } from './turno.errors';

// Tolerancia al desfase del reloj del teléfono respecto del servidor
const DESFASE_MAXIMO_MS = 5 * 60 * 1000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fecha real del evento informada por la app (registrado offline y sincronizado después).
 * Si no viene, el evento ocurre ahora. No se aceptan fechas futuras.
 */
export const fechaDelEvento = (fecha: string | Date | undefined | null, ahora: Date): Date => {
  if (fecha === undefined || fecha === null || fecha === '') return ahora;
  const resultado = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(resultado.getTime()) || resultado.getTime() > ahora.getTime() + DESFASE_MAXIMO_MS) {
    throw turnoError('FECHA_INVALIDA');
  }
  return resultado.getTime() > ahora.getTime() ? ahora : resultado;
};

export const validarIdCliente = (idCliente: string | undefined | null): string | null => {
  if (idCliente === undefined || idCliente === null) return null;
  if (!UUID_REGEX.test(idCliente)) throw turnoError('ID_CLIENTE_INVALIDO');
  return idCliente.toLowerCase();
};
