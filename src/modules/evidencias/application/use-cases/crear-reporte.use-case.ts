import { Injectable, Inject } from '@nestjs/common';
import { REPORTE_REPOSITORY } from '../../domain/repositories/reporte.repository.port';
import type { ReporteRegistro, ReporteRepositoryPort, TipoReporte } from '../../domain/repositories/reporte.repository.port';
import { TURNO_REPOSITORY } from '../../../turnos/domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../../turnos/domain/repositories/turno.repository.port';
import { buscarTurnoDelOperador } from '../../../turnos/application/use-cases/finalizar-turno.use-case';
import { fechaDelEvento, validarIdCliente } from '../../../turnos/application/datos-cliente';
import { turnoError } from '../../../turnos/application/turno.errors';
import { evidenciaError } from '../evidencia.errors';

const TIPOS: TipoReporte[] = ['INICIO', 'FIN', 'NOVEDAD'];

export interface CrearReporteDto {
  idOperador: number;
  idCliente: string;
  idTurno?: number | null;
  idClienteTurno?: string | null;
  tipo: string;
  descripcion?: string | null;
  fechaHora?: string | Date | null;
}

/**
 * Reporte del turno: instrucciones al iniciar, novedades al cerrar o una novedad durante el turno.
 * Las fotos de evidencia se asocian a un reporte.
 */
@Injectable()
export class CrearReporteUseCase {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly reporteRepo: ReporteRepositoryPort,
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
  ) {}

  async execute(dto: CrearReporteDto, ahora: Date = new Date()): Promise<ReporteRegistro> {
    const idCliente = validarIdCliente(dto.idCliente);
    if (!idCliente) throw turnoError('ID_CLIENTE_INVALIDO');
    if (!TIPOS.includes(dto.tipo as TipoReporte)) throw evidenciaError('TIPO_REPORTE_INVALIDO');

    const turno = await buscarTurnoDelOperador(this.turnoRepo, dto.idOperador, dto);

    const existente = await this.reporteRepo.findByIdCliente(idCliente);
    if (existente) {
      if (existente.idTurno !== turno.id) throw turnoError('ID_CLIENTE_INVALIDO');
      return existente;
    }

    return this.reporteRepo.create({
      idTurno: turno.id!,
      tipo: dto.tipo as TipoReporte,
      descripcion: dto.descripcion?.trim().slice(0, 2000) || null,
      fechaHora: fechaDelEvento(dto.fechaHora, ahora),
      idCliente,
    });
  }
}
