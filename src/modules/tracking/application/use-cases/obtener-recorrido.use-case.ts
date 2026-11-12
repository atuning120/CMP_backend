import { Inject, Injectable } from '@nestjs/common';
import { TRACKING_REPOSITORY } from '../../domain/repositories/tracking.repository.port';
import type { TrackingRepositoryPort } from '../../domain/repositories/tracking.repository.port';
import type { PuntoRecorrido } from '../../domain/entities/posicion-gps';
import { trackingError } from '../tracking.errors';

// Un rango más largo no se lee en un mapa y, a una posición cada 30 s, serían miles de puntos
export const DURACION_MAXIMA_MS = 48 * 60 * 60 * 1000;
// Tope de puntos por respuesta (48 h a 30 s son 5.760): protege ante un dispositivo que reporte muy seguido
export const MAXIMO_PUNTOS = 10_000;
// Igual que al recibir posiciones: un reloj adelantado puede dejar una posición unos minutos en el futuro
const MARGEN_FUTURO_MS = 5 * 60 * 1000;

export interface Recorrido {
  idMaquina: number;
  desde: Date;
  hasta: Date | null; // null = hasta ahora: el panel le suma las posiciones que llegan por WebSocket
  puntos: PuntoRecorrido[]; // de la más antigua a la más nueva
  truncado: boolean; // true si había más de MAXIMO_PUNTOS (se devuelven los primeros)
}

const leerFecha = (valor: unknown): Date | null => {
  if (typeof valor !== 'string' || valor.trim() === '') return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/**
 * Recorrido GPS de una máquina (TRACKING_HISTORY) para dibujarlo en el mapa del panel: en un rango de fechas
 * ("hoy") o durante un turno.
 */
@Injectable()
export class ObtenerRecorridoUseCase {
  constructor(
    @Inject(TRACKING_REPOSITORY)
    private readonly trackingRepo: TrackingRepositoryPort,
  ) {}

  // desde obligatorio; hasta opcional (sin él, hasta ahora). Fechas ISO
  async porMaquina(idMaquina: number, desdeTexto: unknown, hastaTexto: unknown, ahora: Date = new Date()): Promise<Recorrido> {
    const desde = leerFecha(desdeTexto);
    if (!desde) throw trackingError('RANGO_INVALIDO', 'Falta la fecha de inicio (desde) o no es válida');
    const hasta = hastaTexto === undefined || hastaTexto === '' ? null : leerFecha(hastaTexto);
    if (hastaTexto !== undefined && hastaTexto !== '' && !hasta) {
      throw trackingError('RANGO_INVALIDO', 'La fecha de término (hasta) no es válida');
    }
    const fin = hasta ?? ahora;
    if (fin.getTime() <= desde.getTime()) throw trackingError('RANGO_INVALIDO', 'La fecha de término debe ser posterior a la de inicio');
    if (fin.getTime() - desde.getTime() > DURACION_MAXIMA_MS) {
      throw trackingError('RANGO_INVALIDO', 'El rango no puede superar las 48 horas');
    }
    return this.leer(idMaquina, desde, hasta, ahora);
  }

  // Del inicio al término del turno, o hasta ahora si sigue en curso
  async porTurno(idTurno: number, ahora: Date = new Date()): Promise<Recorrido> {
    const turno = await this.trackingRepo.periodoDeTurno(idTurno);
    if (!turno) throw trackingError('TURNO_NO_ENCONTRADO');
    return this.leer(turno.idMaquina, turno.inicio, turno.fin, ahora);
  }

  private async leer(idMaquina: number, desde: Date, hasta: Date | null, ahora: Date): Promise<Recorrido> {
    const tope = hasta ?? new Date(ahora.getTime() + MARGEN_FUTURO_MS);
    // Se pide uno más para saber si quedaron puntos afuera sin hacer un COUNT
    const puntos = await this.trackingRepo.recorrido(idMaquina, desde, tope, MAXIMO_PUNTOS + 1);
    return { idMaquina, desde, hasta, puntos: puntos.slice(0, MAXIMO_PUNTOS), truncado: puntos.length > MAXIMO_PUNTOS };
  }
}
