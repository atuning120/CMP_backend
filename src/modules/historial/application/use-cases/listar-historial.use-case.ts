import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { HISTORIAL_REPOSITORY } from '../../domain/repositories/historial.repository.port';
import type { EventoHistorial, HistorialRepositoryPort } from '../../domain/repositories/historial.repository.port';
import { leerRangoPaginado } from '../../../../shared/application/rango-paginado';
import type { RangoPaginadoDto } from '../../../../shared/application/rango-paginado';

export type FiltroTipoHistorial = 'TODO' | 'TURNOS' | 'FLOTA';

export interface ListarHistorialDto extends RangoPaginadoDto {
  rol: string;
  tipo?: unknown;
}

export interface PaginaHistorial {
  eventos: EventoHistorial[];
  hayMas: boolean;
}

const ROLES_PERMITIDOS = ['JEFE_TURNO', 'ADMIN'];

// Lo comparte la exportación a Excel: mismos roles y mismo filtro de tipo
export const exigirRolHistorial = (rol: string, accion = 'ver el historial') => {
  if (!ROLES_PERMITIDOS.includes(rol)) {
    throw new ForbiddenException({ statusCode: 403, code: 'SIN_PERMISO', message: `Solo un jefe de turno o administrador puede ${accion}` });
  }
};

export const leerTipoHistorial = (tipo: unknown): FiltroTipoHistorial => (tipo === 'TURNOS' || tipo === 'FLOTA' ? tipo : 'TODO');

@Injectable()
export class ListarHistorialUseCase {
  constructor(
    @Inject(HISTORIAL_REPOSITORY)
    private readonly historialRepo: HistorialRepositoryPort,
  ) {}

  async execute(dto: ListarHistorialDto): Promise<PaginaHistorial> {
    exigirRolHistorial(dto.rol);

    const tipo = leerTipoHistorial(dto.tipo);
    const { limite, ...rango } = leerRangoPaginado(dto);

    // Se pide uno más para saber si hay otra página sin hacer un COUNT
    const eventos = await this.historialRepo.listar({
      incluirTurnos: tipo !== 'FLOTA',
      incluirFlota: tipo !== 'TURNOS',
      ...rango,
      limite: limite + 1,
    });
    return { eventos: eventos.slice(0, limite), hayMas: eventos.length > limite };
  }
}
