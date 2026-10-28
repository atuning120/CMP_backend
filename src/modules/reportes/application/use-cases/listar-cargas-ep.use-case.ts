import { Inject, Injectable } from '@nestjs/common';
import { CARGA_EP_REPOSITORY } from '../../domain/repositories/carga-ep.repository.port';
import type { CargaEp, CargaEpRepositoryPort } from '../../domain/repositories/carga-ep.repository.port';
import { reporteError } from '../reporte.errors';

// Todos los roles del panel web ven los dashboards (el VISOR solo mira); solo ADMIN y JEFE_TURNO cargan el Excel
export const ROLES_DASHBOARD = ['ADMIN', 'JEFE_TURNO', 'VISOR'];

export const exigirRolDashboard = (rol: string) => {
  if (!ROLES_DASHBOARD.includes(rol)) throw reporteError('SIN_PERMISO');
};

// Meses con estado de pago cargado, para el selector de período del dashboard
@Injectable()
export class ListarCargasEpUseCase {
  constructor(
    @Inject(CARGA_EP_REPOSITORY)
    private readonly cargaRepo: CargaEpRepositoryPort,
  ) {}

  async execute(rol: string): Promise<CargaEp[]> {
    exigirRolDashboard(rol);
    return this.cargaRepo.listarVigentes();
  }
}
