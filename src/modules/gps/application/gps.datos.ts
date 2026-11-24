import { MODELO_APP_MOVIL } from '../domain/repositories/gps.repository.port';
import { gpsError } from './gps.errors';

// Validación y normalización compartidas por los use cases de GPS

export interface AutorGps {
  rol?: string;
  idUsuario?: number;
}

const ROLES_GESTION_GPS = ['JEFE_TURNO', 'ADMIN'];

// Devuelve el id del usuario, para la bitácora
export const exigirGestion = (autor: AutorGps): number => {
  if (!autor.rol || !ROLES_GESTION_GPS.includes(autor.rol) || !autor.idUsuario) throw gpsError('SIN_PERMISO');
  return autor.idUsuario;
};

// Largos de las columnas de DISPOSITIVO_GPS y BITACORA_JEFE_TURNO (observacion es TEXT; el límite evita abusos)
const LARGOS = { modelo: 50, numeroSim: 30, motivo: 100, observacion: 500 } as const;
const ETIQUETAS = { modelo: 'modelo', numeroSim: 'N° de SIM', motivo: 'motivo', observacion: 'observación' } as const;

export const texto = (campo: keyof typeof LARGOS, valor: unknown): string | null => {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw gpsError('DATOS_INVALIDOS', `El campo ${ETIQUETAS[campo]} no es válido`);
  const limpio = valor.trim();
  if (limpio.length > LARGOS[campo]) {
    throw gpsError('DATOS_INVALIDOS', `El campo ${ETIQUETAS[campo]} admite hasta ${LARGOS[campo]} caracteres`);
  }
  return limpio === '' ? null : limpio;
};

// El GPS virtual de la app se reconoce por este modelo: un GPS real no puede llevarlo
export const leerModelo = (valor: unknown): string | null => {
  const modelo = texto('modelo', valor);
  if (modelo?.toUpperCase() === MODELO_APP_MOVIL) throw gpsError('DATOS_INVALIDOS', 'Ese modelo está reservado para la app móvil');
  return modelo;
};

export const leerMotivo = (valor: unknown): string => {
  const motivo = texto('motivo', valor);
  if (!motivo) throw gpsError('DATOS_INVALIDOS', 'El motivo es obligatorio');
  return motivo;
};

// Id de máquina o GPS que puede venir vacío (null). Cualquier otra cosa, también ausente, es inválida
export const idONulo = (campo: string, valor: unknown): number | null => {
  if (valor === null) return null;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) throw gpsError('DATOS_INVALIDOS', `El campo ${campo} no es válido`);
  return valor;
};

// El último dígito de un IMEI es verificador (Luhn): detecta un dígito mal copiado de la etiqueta
const luhnValido = (digitos: string) => {
  let suma = 0;
  digitos.split('').reverse().forEach((d, i) => {
    const n = Number(d) * (i % 2 === 1 ? 2 : 1);
    suma += n > 9 ? n - 9 : n;
  });
  return suma % 10 === 0;
};

// Acepta espacios y guiones, como se copia de una etiqueta
export const leerImei = (valor: unknown): string => {
  const imei = typeof valor === 'string' ? valor.replace(/[\s-]/g, '') : '';
  // 9000…: IMEI virtuales de la app
  if (!/^\d{15}$/.test(imei) || imei.startsWith('9000') || !luhnValido(imei)) throw gpsError('IMEI_INVALIDO');
  return imei;
};
