import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ALERTA_TURNO_REPOSITORY } from '../../domain/repositories/alerta-turno.repository.port';
import type { AlertaTurno, AlertaTurnoRepositoryPort, EstadoAtencionAlerta } from '../../domain/repositories/alerta-turno.repository.port';
import { leerRangoPaginado } from '../../../../shared/application/rango-paginado';
import type { RangoPaginadoDto } from '../../../../shared/application/rango-paginado';

export type FiltroTipoAlerta = 'TODO' | 'EXTENDIDOS' | 'CIERRES_AUTOMATICOS' | 'MANTENCIONES';
const FILTROS_TIPO: FiltroTipoAlerta[] = ['EXTENDIDOS', 'CIERRES_AUTOMATICOS', 'MANTENCIONES'];

export interface ListarAlertasDto extends RangoPaginadoDto {
  rol: string;
  tipo?: unknown;
  estado?: unknown; // TODAS | PENDIENTES | ATENDIDAS
}

export interface PaginaAlertas {
  alertas: AlertaTurno[];
  hayMas: boolean;
  // Lo que requiere acción ahora, sin importar el rango (contador de la pestaña): operadores con más de 10 h trabajadas
  // (turno o jornada) y máquinas detenidas en mantención o falla
  activas: number;
}

// También los únicos que reciben las alertas en tiempo real (AlertasGateway)
export const ROLES_ALERTAS = ['JEFE_TURNO', 'ADMIN'];

@Injectable()
export class ListarAlertasUseCase {
  constructor(
    @Inject(ALERTA_TURNO_REPOSITORY)
    private readonly alertaRepo: AlertaTurnoRepositoryPort,
  ) {}

  async execute(dto: ListarAlertasDto): Promise<PaginaAlertas> {
    if (!ROLES_ALERTAS.includes(dto.rol)) {
      throw new ForbiddenException({ statusCode: 403, code: 'SIN_PERMISO', message: 'Solo un jefe de turno o administrador puede ver las alertas' });
    }

    const tipo: FiltroTipoAlerta = FILTROS_TIPO.find((t) => t === dto.tipo) ?? 'TODO';
    const estado: EstadoAtencionAlerta = dto.estado === 'PENDIENTES' || dto.estado === 'ATENDIDAS' ? dto.estado : 'TODAS';
    const { limite, ...rango } = leerRangoPaginado(dto);

    // Se pide una más para saber si hay otra página sin hacer un COUNT
    const [alertas, activas] = await Promise.all([
      this.alertaRepo.listar({
        incluirExtendidos: tipo === 'TODO' || tipo === 'EXTENDIDOS',
        incluirCierresAutomaticos: tipo === 'TODO' || tipo === 'CIERRES_AUTOMATICOS',
        incluirMantenciones: tipo === 'TODO' || tipo === 'MANTENCIONES',
        estado,
        ...rango,
        limite: limite + 1,
      }),
      this.alertaRepo.contarActivas(),
    ]);
    return { alertas: alertas.slice(0, limite), hayMas: alertas.length > limite, activas };
  }
}
