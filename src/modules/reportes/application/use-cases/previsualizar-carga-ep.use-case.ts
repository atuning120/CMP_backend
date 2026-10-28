import { Inject, Injectable } from '@nestjs/common';
import { CARGA_EP_REPOSITORY } from '../../domain/repositories/carga-ep.repository.port';
import type { CargaEpRepositoryPort } from '../../domain/repositories/carga-ep.repository.port';
import { LECTOR_EXCEL_EP } from '../../domain/ports/lector-excel-ep.port';
import type { LectorExcelEpPort } from '../../domain/ports/lector-excel-ep.port';
import { leerCargaEp } from './leer-carga-ep';
import type { ResumenCargaEp, SolicitudCargaEp } from './leer-carga-ep';

export type VistaPreviaCargaEp = Omit<ResumenCargaEp, 'registros' | 'hashSha256'> & {
  filasValidas: number;
  puedeConfirmar: boolean; // sin errores y con al menos una fila
};

// Lo que se guardaría al confirmar, para revisarlo antes: filas válidas, errores por fila, horas por equipo, equipos
// que no están en la flota y actividades sin área. No guarda nada
@Injectable()
export class PrevisualizarCargaEpUseCase {
  constructor(
    @Inject(LECTOR_EXCEL_EP)
    private readonly lector: LectorExcelEpPort,
    @Inject(CARGA_EP_REPOSITORY)
    private readonly cargaRepo: CargaEpRepositoryPort,
  ) {}

  async execute(dto: SolicitudCargaEp): Promise<VistaPreviaCargaEp> {
    const { registros, hashSha256: _hash, ...resumen } = await leerCargaEp(dto, this.lector, this.cargaRepo);
    return { ...resumen, filasValidas: registros.length, puedeConfirmar: resumen.totalErrores === 0 && registros.length > 0 };
  }
}
