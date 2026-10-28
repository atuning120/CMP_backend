import { Inject, Injectable } from '@nestjs/common';
import { CARGA_EP_REPOSITORY } from '../../domain/repositories/carga-ep.repository.port';
import type { CargaEp, CargaEpRepositoryPort } from '../../domain/repositories/carga-ep.repository.port';
import { LECTOR_EXCEL_EP } from '../../domain/ports/lector-excel-ep.port';
import type { LectorExcelEpPort } from '../../domain/ports/lector-excel-ep.port';
import { reporteError } from '../reporte.errors';
import { leerCargaEp } from './leer-carga-ep';
import type { SolicitudCargaEp } from './leer-carga-ep';

export interface ConfirmarCargaEpDto extends SolicitudCargaEp {
  idUsuario: number;
  reemplazar?: boolean; // obligatorio si el mes ya tiene una carga
}

// Guarda el Excel del mes. Se rechaza entero si alguna fila tiene errores: un EP a medias daría comparaciones falsas
@Injectable()
export class ConfirmarCargaEpUseCase {
  constructor(
    @Inject(LECTOR_EXCEL_EP)
    private readonly lector: LectorExcelEpPort,
    @Inject(CARGA_EP_REPOSITORY)
    private readonly cargaRepo: CargaEpRepositoryPort,
  ) {}

  async execute(dto: ConfirmarCargaEpDto): Promise<CargaEp> {
    const resumen = await leerCargaEp(dto, this.lector, this.cargaRepo);
    if (resumen.totalErrores > 0) throw reporteError('EXCEL_CON_ERRORES', resumen.errores);
    if (!resumen.registros.length) {
      throw reporteError('EXCEL_CON_ERRORES', [{ fila: null, mensaje: 'La hoja "Base de datos" no tiene filas' }]);
    }
    if (resumen.cargaExistente && !dto.reemplazar) throw reporteError('CARGA_EXISTENTE');

    const carga = await this.cargaRepo.reemplazar({
      periodo: resumen.periodo,
      fechaDesde: resumen.fechaDesde,
      fechaHasta: resumen.fechaHasta,
      archivo: resumen.archivo,
      hashSha256: resumen.hashSha256,
      idUsuario: dto.idUsuario,
      registros: resumen.registros,
    });
    if (!carga) throw reporteError('CARGA_SIMULTANEA');
    return carga;
  }
}
