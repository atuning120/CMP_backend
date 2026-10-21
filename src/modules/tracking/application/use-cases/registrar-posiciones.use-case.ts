import { Inject, Injectable, Logger } from '@nestjs/common';
import { TRACKING_REPOSITORY } from '../../domain/repositories/tracking.repository.port';
import type { TrackingRepositoryPort } from '../../domain/repositories/tracking.repository.port';
import type { PosicionDispositivo } from '../../domain/entities/posicion-gps';
import { PUBLICADOR_POSICIONES } from '../ports/publicador-posiciones.port';
import type { PublicadorPosicionesPort } from '../ports/publicador-posiciones.port';
import { trackingError } from '../tracking.errors';

const MAXIMO_POR_LOTE = 500;
// Un dispositivo guarda posiciones sin señal y las reenvía después; más antiguas que esto no se aceptan
const ANTIGUEDAD_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000;
// Margen para relojes adelantados
const FUTURO_MAXIMO_MS = 5 * 60 * 1000;
const IMEI = /^\d{15}$/;
const LARGO_MAXIMO_TRAMA = 1024;

export interface ResultadoRegistro {
  recibidas: number;
  guardadas: number;
  descartadas: number;
}

const numeroOpcional = (valor: unknown, min: number, max: number): number | null =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= min && valor <= max ? valor : null;

/**
 * Valida una posición que viene del adaptador. Devuelve null si no sirve: IMEI o coordenadas inválidas,
 * o una fecha fuera de rango. Los datos opcionales fuera de rango se guardan como null.
 */
export function validarPosicion(dato: unknown, ahora: Date): PosicionDispositivo | null {
  if (typeof dato !== 'object' || dato === null) return null;
  const p = dato as Record<string, unknown>;
  if (typeof p.imei !== 'string' || !IMEI.test(p.imei)) return null;
  const fechaHora = typeof p.fechaHora === 'string' ? new Date(p.fechaHora) : null;
  if (!fechaHora || Number.isNaN(fechaHora.getTime())) return null;
  const diferencia = fechaHora.getTime() - ahora.getTime();
  if (diferencia > FUTURO_MAXIMO_MS || diferencia < -ANTIGUEDAD_MAXIMA_MS) return null;
  const latitud = numeroOpcional(p.latitud, -90, 90);
  const longitud = numeroOpcional(p.longitud, -180, 180);
  // GT06 manda 0,0 cuando no tiene posición
  if (latitud === null || longitud === null || (latitud === 0 && longitud === 0)) return null;
  return {
    imei: p.imei,
    fechaHora,
    latitud,
    longitud,
    velocidad: numeroOpcional(p.velocidad, 0, 500),
    rumbo: numeroOpcional(p.rumbo, 0, 360),
    bateria: numeroOpcional(p.bateria, 0, 100),
    satelites: numeroOpcional(p.satelites, 0, 99),
    enTiempoReal: p.enTiempoReal !== false,
    tramaHex: typeof p.tramaHex === 'string' ? p.tramaHex.slice(0, LARGO_MAXIMO_TRAMA) : null,
  };
}

/**
 * Recibe un lote de posiciones del adaptador, guarda las válidas y las publica en tiempo real. Una posición
 * inválida no rechaza el lote: se descarta sola, para que el adaptador no pierda las demás.
 */
@Injectable()
export class RegistrarPosicionesUseCase {
  private readonly logger = new Logger(RegistrarPosicionesUseCase.name);

  constructor(
    @Inject(TRACKING_REPOSITORY)
    private readonly trackingRepo: TrackingRepositoryPort,
    @Inject(PUBLICADOR_POSICIONES)
    private readonly publicador: PublicadorPosicionesPort,
  ) {}

  async execute(posiciones: unknown, ahora: Date = new Date()): Promise<ResultadoRegistro> {
    if (!Array.isArray(posiciones) || posiciones.length === 0 || posiciones.length > MAXIMO_POR_LOTE) {
      throw trackingError('LOTE_INVALIDO');
    }
    const validas = posiciones.map((p) => validarPosicion(p, ahora)).filter((p): p is PosicionDispositivo => p !== null);
    const guardadas = validas.length > 0 ? await this.trackingRepo.guardar(validas) : [];

    const descartadas = posiciones.length - guardadas.length;
    if (descartadas > 0) {
      // Inválidas, repetidas o, lo más común, de un IMEI sin registrar en DISPOSITIVO_GPS o sin asignación vigente
      const imeis = [...new Set(validas.map((p) => p.imei))].join(', ');
      this.logger.warn(`${descartadas} de ${posiciones.length} posiciones no se guardaron (IMEI válidos recibidos: ${imeis || 'ninguno'})`);
    }
    if (guardadas.length > 0) this.publicador.publicar(guardadas);
    return { recibidas: posiciones.length, guardadas: guardadas.length, descartadas };
  }
}
