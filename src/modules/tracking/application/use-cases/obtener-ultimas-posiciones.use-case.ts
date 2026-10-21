import { Inject, Injectable } from '@nestjs/common';
import { TRACKING_REPOSITORY } from '../../domain/repositories/tracking.repository.port';
import type { TrackingRepositoryPort } from '../../domain/repositories/tracking.repository.port';
import type { PosicionMaquina } from '../../domain/entities/posicion-gps';

// Un turno dura como máximo 13 h: posiciones más antiguas ya no dicen dónde está la máquina hoy
const VENTANA_MS = 13 * 60 * 60 * 1000;

// Última posición GPS de cada máquina, para pintar el mapa al abrirlo (después llegan por WebSocket)
@Injectable()
export class ObtenerUltimasPosicionesUseCase {
  constructor(
    @Inject(TRACKING_REPOSITORY)
    private readonly trackingRepo: TrackingRepositoryPort,
  ) {}

  async execute(ahora: Date = new Date()): Promise<PosicionMaquina[]> {
    return this.trackingRepo.ultimasPorMaquina(new Date(ahora.getTime() - VENTANA_MS));
  }
}
