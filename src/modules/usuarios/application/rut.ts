// Dígito verificador de un RUT chileno (módulo 11)
const digitoVerificador = (cuerpo: string): string => {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
};

/**
 * Valida un RUT escrito de cualquier forma ("12345678-5", "12.345.678-5", "123456785") y lo devuelve
 * con el formato de la tabla OPERADOR ("12.345.678-5"), o null si no es válido.
 */
export const normalizarRut = (rut: unknown): string | null => {
  if (typeof rut !== 'string') return null;
  const limpio = rut.replace(/[.\s-]/g, '').toUpperCase();
  const partes = /^(\d{7,8})([0-9K])$/.exec(limpio);
  if (!partes) return null;
  const [, cuerpo, dv] = partes;
  if (digitoVerificador(cuerpo) !== dv) return null;
  return `${cuerpo.replace(/\B(?=(\d{3})+$)/g, '.')}-${dv}`;
};
