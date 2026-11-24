import { Inject, Injectable } from '@nestjs/common';
import { GPS_REPOSITORY, GpsModificadoError } from '../../domain/repositories/gps.repository.port';
import type { AccionGps, CambioAsignacion, DispositivoGps, GpsRepositoryPort } from '../../domain/repositories/gps.repository.port';
import { exigirGestion, idONulo, leerMotivo, texto } from '../gps.datos';
import type { AutorGps } from '../gps.datos';
import { gpsError } from '../gps.errors';

export interface AsignarGpsDto {
  idMaquina?: unknown; // la de destino
  idMaquinaActual?: unknown; // dónde vio el usuario el GPS (null: sin máquina)
  idGpsDesplazado?: unknown; // el GPS que vio en el destino y aceptó sacar (null: ninguno)
  motivo?: unknown;
  observacion?: unknown;
}

export type DesvincularGpsDto = Pick<AsignarGpsDto, 'idMaquinaActual' | 'motivo' | 'observacion'>;

const conDetalle = (auto: string, observacion: string | null) => (observacion ? `${auto} · ${observacion}` : auto);

/**
 * Pone un GPS en una máquina, lo mueve a otra (p. ej. la que reemplaza a una con problemas) o lo desvincula. Un GPS
 * está en una sola máquina y una máquina tiene un solo GPS real: si el destino ya tenía otro, queda sin máquina (el
 * usuario lo confirma mandando idGpsDesplazado). Las posiciones anteriores siguen siendo de la máquina en que estaba.
 */
@Injectable()
export class CambiarAsignacionGpsUseCase {
  constructor(
    @Inject(GPS_REPOSITORY)
    private readonly gpsRepo: GpsRepositoryPort,
  ) {}

  async asignar(autor: AutorGps, idGps: number, dto: AsignarGpsDto): Promise<DispositivoGps> {
    const idUsuario = exigirGestion(autor);
    const idMaquina = idONulo('idMaquina', dto.idMaquina);
    if (idMaquina === null) throw gpsError('DATOS_INVALIDOS', 'Elige la máquina');
    const gps = await this.leerGps(idGps, dto.idMaquinaActual);
    if (!gps.activo) throw gpsError('GPS_INACTIVO');
    const idGpsDesplazado = idONulo('idGpsDesplazado', dto.idGpsDesplazado);
    const motivo = leerMotivo(dto.motivo);
    const observacion = texto('observacion', dto.observacion);

    const nombre = await this.gpsRepo.nombreMaquina(idMaquina);
    if (!nombre) throw gpsError('MAQUINA_NO_ENCONTRADA');
    if (gps.maquina?.idMaquina === idMaquina) throw gpsError('SIN_CAMBIOS', `El GPS ya está en ${nombre}`);
    const desplazado = await this.gpsRepo.deMaquina(idMaquina);
    if (desplazado && idGpsDesplazado === null) throw gpsError('MAQUINA_CON_GPS', `${nombre} ya tiene el GPS ${desplazado.imei}`);
    if ((desplazado?.idGps ?? null) !== idGpsDesplazado) throw gpsError('GPS_MODIFICADO');

    const partes = [
      gps.maquina ? `GPS ${gps.imei} traído desde ${gps.maquina.nombre}` : `GPS ${gps.imei} vinculado`,
      ...(desplazado ? [`sale el GPS ${desplazado.imei}`] : []),
    ];
    const acciones: AccionGps[] = [
      {
        idMaquina,
        idUsuario,
        motivo,
        observacion: conDetalle(partes.join('; '), observacion),
        detalle: { antes: { gps: desplazado?.imei ?? null }, despues: { gps: gps.imei } },
      },
    ];
    if (gps.maquina) {
      acciones.push({
        idMaquina: gps.maquina.idMaquina,
        idUsuario,
        motivo,
        observacion: conDetalle(`Su GPS ${gps.imei} pasó a ${nombre}`, observacion),
        detalle: { antes: { gps: gps.imei }, despues: { gps: null } },
      });
    }
    return this.guardar({ idGps, idMaquina, idMaquinaActual: gps.maquina?.idMaquina ?? null, idGpsDesplazado, acciones });
  }

  async desvincular(autor: AutorGps, idGps: number, dto: DesvincularGpsDto): Promise<DispositivoGps> {
    const idUsuario = exigirGestion(autor);
    const gps = await this.leerGps(idGps, dto.idMaquinaActual);
    if (!gps.maquina) throw gpsError('GPS_SIN_MAQUINA');
    const motivo = leerMotivo(dto.motivo);
    const observacion = texto('observacion', dto.observacion);
    const { idMaquina } = gps.maquina;
    const accion: AccionGps = {
      idMaquina,
      idUsuario,
      motivo,
      observacion: conDetalle(`GPS ${gps.imei} desvinculado`, observacion),
      detalle: { antes: { gps: gps.imei }, despues: { gps: null } },
    };
    return this.guardar({ idGps, idMaquina: null, idMaquinaActual: idMaquina, idGpsDesplazado: null, acciones: [accion] });
  }

  // El GPS, si sigue en la máquina en que lo vio el usuario
  private async leerGps(idGps: number, vista: unknown): Promise<DispositivoGps> {
    const gps = await this.gpsRepo.buscar(idGps);
    if (!gps) throw gpsError('GPS_NO_ENCONTRADO');
    if ((gps.maquina?.idMaquina ?? null) !== idONulo('idMaquinaActual', vista)) throw gpsError('GPS_MODIFICADO');
    return gps;
  }

  private async guardar(cambio: CambioAsignacion): Promise<DispositivoGps> {
    try {
      await this.gpsRepo.cambiarAsignacion(cambio);
    } catch (error) {
      if (error instanceof GpsModificadoError) throw gpsError('GPS_MODIFICADO');
      throw error;
    }
    const gps = await this.gpsRepo.buscar(cambio.idGps);
    if (!gps) throw gpsError('GPS_NO_ENCONTRADO');
    return gps;
  }
}
