import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { HISTORIAL_REPOSITORY } from '../../domain/repositories/historial.repository.port';
import type { EventoHistorial, HistorialRepositoryPort } from '../../domain/repositories/historial.repository.port';

export type FiltroTipoHistorial = 'TODO' | 'TURNOS' | 'FLOTA';

export interface ListarHistorialDto {
  rol: string;
  tipo?: unknown;
  antes?: unknown;
  limite?: unknown;
}

export interface PaginaHistorial {
  eventos: EventoHistorial[];
  hayMas: boolean;
}

const ROLES_PERMITIDOS = ['JEFE_TURNO', 'ADMIN'];
const LIMITE_POR_DEFECTO = 30;
const LIMITE_MAXIMO = 50;

@Injectable()
export class ListarHistorialUseCase {
  constructor(
    @Inject(HISTORIAL_REPOSITORY)
    private readonly historialRepo: HistorialRepositoryPort,
  ) {}

  async execute(dto: ListarHistorialDto): Promise<PaginaHistorial> {
    if (!ROLES_PERMITIDOS.includes(dto.rol)) {
      throw new ForbiddenException({ statusCode: 403, code: 'SIN_PERMISO', message: 'Solo un jefe de turno o administrador puede ver el historial' });
    }

    const tipo: FiltroTipoHistorial = dto.tipo === 'TURNOS' || dto.tipo === 'FLOTA' ? dto.tipo : 'TODO';
    const limiteNumero = Number(dto.limite);
    const limite = Number.isInteger(limiteNumero) && limiteNumero > 0 ? Math.min(limiteNumero, LIMITE_MAXIMO) : LIMITE_POR_DEFECTO;
    const antes = typeof dto.antes === 'string' ? new Date(dto.antes) : null;

    // Se pide uno más para saber si hay otra página sin hacer un COUNT
    const eventos = await this.historialRepo.listar({
      incluirTurnos: tipo !== 'FLOTA',
      incluirFlota: tipo !== 'TURNOS',
      antesDe: antes && !Number.isNaN(antes.getTime()) ? antes : null,
      limite: limite + 1,
    });
    return { eventos: eventos.slice(0, limite), hayMas: eventos.length > limite };
  }
}
