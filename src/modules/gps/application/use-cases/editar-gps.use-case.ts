import { Inject, Injectable } from '@nestjs/common';
import { GPS_REPOSITORY, GpsModificadoError } from '../../domain/repositories/gps.repository.port';
import type { CambiosGps, DispositivoGps, GpsRepositoryPort } from '../../domain/repositories/gps.repository.port';
import { exigirGestion, leerModelo, texto } from '../gps.datos';
import type { AutorGps } from '../gps.datos';
import { gpsError } from '../gps.errors';

export interface EditarGpsDto {
  modelo?: unknown;
  numeroSim?: unknown;
  activo?: unknown;
}

// Modelo, SIM y baja o reactivación. El IMEI no se cambia: identifica al equipo y a todo su historial
@Injectable()
export class EditarGpsUseCase {
  constructor(
    @Inject(GPS_REPOSITORY)
    private readonly gpsRepo: GpsRepositoryPort,
  ) {}

  async execute(autor: AutorGps, idGps: number, dto: EditarGpsDto): Promise<DispositivoGps> {
    exigirGestion(autor);
    const gps = await this.gpsRepo.buscar(idGps);
    if (!gps) throw gpsError('GPS_NO_ENCONTRADO');

    const cambios: CambiosGps = {};
    if (dto.modelo !== undefined) cambios.modelo = leerModelo(dto.modelo);
    if (dto.numeroSim !== undefined) cambios.numeroSim = texto('numeroSim', dto.numeroSim);
    if (dto.activo !== undefined) {
      if (typeof dto.activo !== 'boolean') throw gpsError('DATOS_INVALIDOS', 'El campo activo no es válido');
      cambios.activo = dto.activo;
    }
    if (Object.keys(cambios).length === 0) throw gpsError('SIN_CAMBIOS');
    if (cambios.activo === false && gps.maquina) throw gpsError('GPS_ASIGNADO', gps.maquina.nombre);

    try {
      await this.gpsRepo.editar(idGps, cambios);
    } catch (error) {
      if (error instanceof GpsModificadoError) throw gpsError('GPS_MODIFICADO');
      throw error;
    }
    const editado = await this.gpsRepo.buscar(idGps);
    if (!editado) throw gpsError('GPS_NO_ENCONTRADO');
    return editado;
  }
}
