import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

export const LARGO_MINIMO_PASSWORD = 8;
// bcrypt solo usa los primeros 72 bytes: más allá, dos contraseñas distintas darían el mismo hash
const BYTES_MAXIMOS_PASSWORD = 72;

// Regla mínima para cuentas nuevas. Las contraseñas existentes no se revisan: siguen sirviendo hasta que se cambien
export const exigirPasswordSegura = (password: unknown): string => {
  if (typeof password !== 'string' || password.trim().length < LARGO_MINIMO_PASSWORD) {
    throw new BadRequestException({
      statusCode: 400,
      code: 'PASSWORD_DEBIL',
      message: `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`,
    });
  }
  if (Buffer.byteLength(password, 'utf8') > BYTES_MAXIMOS_PASSWORD) {
    throw new BadRequestException({ statusCode: 400, code: 'PASSWORD_DEBIL', message: 'La contraseña es demasiado larga' });
  }
  return password;
};

// Hash de una contraseña aleatoria descartada, con el mismo costo (10) que las cuentas reales
const HASH_SIMULADO = '$2b$10$XTDo8db7dUtNY3G4BuFD..mkvDhuZhe7Vzt.9kCN3ygno1e8hIJni';

/**
 * Compara la contraseña aunque la cuenta no exista o no tenga contraseña: así la respuesta tarda lo mismo
 * en todos los casos y el tiempo no revela qué correos o RUT están registrados.
 */
export const passwordCorrecta = async (password: string, passwordHash: string | null | undefined): Promise<boolean> => {
  const coincide = await bcrypt.compare(password, passwordHash || HASH_SIMULADO);
  return Boolean(passwordHash) && coincide;
};
