import { Logger } from '@nestjs/common';

// Valor de ejemplo de .env.example: sirve en desarrollo, pero con él cualquiera puede firmar tokens
const JWT_SECRET_DE_EJEMPLO = 'super_secret_dev_key';
const LARGO_RECOMENDADO_JWT_SECRET = 32;

const enProduccion = () => process.env.NODE_ENV === 'production';

/**
 * Clave con la que se firman y verifican los JWT. Sin valor por defecto: si faltara, el Backend firmaría con una
 * clave conocida y cualquiera podría fabricar tokens de ADMIN. Por eso el arranque falla en vez de seguir.
 */
export const leerJwtSecret = (valor: string | undefined): string => {
  const secreto = valor?.trim();
  if (!secreto) throw new Error('Falta la variable de entorno JWT_SECRET');
  if (enProduccion() && secreto === JWT_SECRET_DE_EJEMPLO) {
    throw new Error('JWT_SECRET no puede ser el valor de ejemplo en producción');
  }
  if (enProduccion() && secreto.length < LARGO_RECOMENDADO_JWT_SECRET) {
    new Logger('Configuracion').warn(`JWT_SECRET tiene menos de ${LARGO_RECOMENDADO_JWT_SECRET} caracteres: conviene una más larga`);
  }
  return secreto;
};

// En producción la contraseña de la database debe venir del entorno; en desarrollo se usa la de docker-compose
export const leerDbPassword = (valor: string | undefined): string => {
  if (valor) return valor;
  if (enProduccion()) throw new Error('Falta la variable de entorno DB_PASSWORD');
  return 'cmp_pass';
};
