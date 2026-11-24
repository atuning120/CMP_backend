import { Inject, Injectable } from '@nestjs/common';
import { GPS_REPOSITORY } from '../../domain/repositories/gps.repository.port';
import type { AsignacionGps, DispositivoGps, GpsRepositoryPort } from '../../domain/repositories/gps.repository.port';
import { exigirGestion } from '../gps.datos';
import type { AutorGps } from '../gps.datos';
import { gpsError } from '../gps.errors';

// GPS reales (sin los virtuales de la app) y las máquinas en que estuvo cada uno
@Injectable()
export class ListarGpsUseCase {
  constructor(
    @Inject(GPS_REPOSITORY)
    private readonly gpsRepo: GpsRepositoryPort,
  ) {}

  async execute(autor: AutorGps): Promise<DispositivoGps[]> {
    exigirGestion(autor);
    return this.gpsRepo.listar();
  }

  async historial(autor: AutorGps, idGps: number): Promise<AsignacionGps[]> {
    exigirGestion(autor);
    if (!(await this.gpsRepo.buscar(idGps))) throw gpsError('GPS_NO_ENCONTRADO');
    return this.gpsRepo.historial(idGps);
  }
}
