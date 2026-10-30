import { Inject, Injectable } from '@nestjs/common';
import { CARGA_EP_REPOSITORY } from '../../domain/repositories/carga-ep.repository.port';
import type { CargaEp, CargaEpRepositoryPort } from '../../domain/repositories/carga-ep.repository.port';
import { FIRMADOR_DASHBOARD } from '../../domain/ports/firmador-dashboard.port';
import type { DashboardEmbebido, FirmadorDashboardPort, TipoDashboard } from '../../domain/ports/firmador-dashboard.port';
import { reporteError } from '../reporte.errors';
import { exigirRolDashboard } from './listar-cargas-ep.use-case';
import { leerPeriodo } from './leer-carga-ep';

// Filtro bloqueado del dashboard de estado de pago: en Metabase se llama "id_carga" y apunta a la columna id_carga
export const PARAMETRO_CARGA = 'id_carga';

export interface ObtenerDashboardDto {
  rol: string;
  tipo: unknown; // OPERACION | ESTADO_PAGO
  periodo?: unknown; // AAAA-MM, obligatorio para ESTADO_PAGO
}

export interface DashboardSolicitado extends DashboardEmbebido {
  carga: CargaEp | null;
}

@Injectable()
export class ObtenerDashboardUseCase {
  constructor(
    @Inject(FIRMADOR_DASHBOARD)
    private readonly firmador: FirmadorDashboardPort,
    @Inject(CARGA_EP_REPOSITORY)
    private readonly cargaRepo: CargaEpRepositoryPort,
  ) {}

  async execute(dto: ObtenerDashboardDto, ahora: Date = new Date()): Promise<DashboardSolicitado> {
    exigirRolDashboard(dto.rol);
    if (dto.tipo !== 'OPERACION' && dto.tipo !== 'ESTADO_PAGO') throw reporteError('DASHBOARD_INVALIDO');
    const tipo: TipoDashboard = dto.tipo;

    let carga: CargaEp | null = null;
    const parametros: Record<string, number> = {};
    if (tipo === 'ESTADO_PAGO') {
      carga = await this.cargaRepo.buscarVigente(leerPeriodo(dto.periodo));
      if (!carga) throw reporteError('CARGA_NO_ENCONTRADA');
      parametros[PARAMETRO_CARGA] = carga.idCarga;
    }

    const embebido = this.firmador.firmar(tipo, parametros, ahora);
    if (!embebido) throw reporteError('METABASE_NO_CONFIGURADO');
    if (!(await this.firmador.disponible())) throw reporteError('METABASE_NO_DISPONIBLE');
    return { ...embebido, carga };
  }
}
