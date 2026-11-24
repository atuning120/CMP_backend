import { Inject, Injectable } from '@nestjs/common';
import { GPS_REPOSITORY, ImeiDuplicadoError } from '../../domain/repositories/gps.repository.port';
import type { DispositivoGps, GpsRepositoryPort } from '../../domain/repositories/gps.repository.port';
import { exigirGestion, leerImei, leerModelo, texto } from '../gps.datos';
import type { AutorGps } from '../gps.datos';
import { gpsError } from '../gps.errors';

export interface RegistrarGpsDto {
  imei?: unknown;
  modelo?: unknown;
  numeroSim?: unknown;
}

// Alta de un GPS: queda sin máquina hasta que se vincule
@Injectable()
export class RegistrarGpsUseCase {
  constructor(
    @Inject(GPS_REPOSITORY)
    private readonly gpsRepo: GpsRepositoryPort,
  ) {}

  async execute(autor: AutorGps, dto: RegistrarGpsDto): Promise<DispositivoGps> {
    exigirGestion(autor);
    const imei = leerImei(dto.imei);
    const datos = { imei, modelo: leerModelo(dto.modelo), numeroSim: texto('numeroSim', dto.numeroSim) };
    try {
      const creado = await this.gpsRepo.buscar(await this.gpsRepo.crear(datos));
      if (!creado) throw new Error('No se encontró el GPS después de registrarlo');
      return creado;
    } catch (error) {
      if (error instanceof ImeiDuplicadoError) throw gpsError('IMEI_DUPLICADO', imei);
      throw error;
    }
  }
}
