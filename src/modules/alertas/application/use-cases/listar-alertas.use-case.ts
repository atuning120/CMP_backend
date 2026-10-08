import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ALERTA_TURNO_REPOSITORY } from '../../domain/repositories/alerta-turno.repository.port';
import type { AlertaTurno, AlertaTurnoRepositoryPort } from '../../domain/repositories/alerta-turno.repository.port';
import { leerRangoPaginado } from '../../../../shared/application/rango-paginado';
import type { RangoPaginadoDto } from '../../../../shared/application/rango-paginado';

export type FiltroTipoAlerta = 'TODO' | 'EXTENDIDOS' | 'CIERRES_AUTOMATICOS';

export interface ListarAlertasDto extends RangoPaginadoDto {
  rol: string;
  tipo?: unknown;
}

export interface PaginaAlertas {
  alertas: AlertaTurno[];
  hayMas: boolean;
  // Turnos abiertos hace más de 10 h ahora mismo, sin importar el rango (contador de la pestaña)
  activas: number;
}

const ROLES_PERMITIDOS = ['JEFE_TURNO', 'ADMIN'];

@Injectable()
export class ListarAlertasUseCase {
  constructor(
    @Inject(ALERTA_TURNO_REPOSITORY)
    private readonly alertaRepo: AlertaTurnoRepositoryPort,
  ) {}

  async execute(dto: ListarAlertasDto): Promise<PaginaAlertas> {
    if (!ROLES_PERMITIDOS.includes(dto.rol)) {
      throw new ForbiddenException({ statusCode: 403, code: 'SIN_PERMISO', message: 'Solo un jefe de turno o administrador puede ver las alertas' });
    }

    const tipo: FiltroTipoAlerta = dto.tipo === 'EXTENDIDOS' || dto.tipo === 'CIERRES_AUTOMATICOS' ? dto.tipo : 'TODO';
    const { limite, ...rango } = leerRangoPaginado(dto);

    // Se pide una más para saber si hay otra página sin hacer un COUNT
    const [alertas, activas] = await Promise.all([
      this.alertaRepo.listar({
        incluirExtendidos: tipo !== 'CIERRES_AUTOMATICOS',
        incluirCierresAutomaticos: tipo !== 'EXTENDIDOS',
        ...rango,
        limite: limite + 1,
      }),
      this.alertaRepo.contarExtendidosEnCurso(),
    ]);
    return { alertas: alertas.slice(0, limite), hayMas: alertas.length > limite, activas };
  }
}
