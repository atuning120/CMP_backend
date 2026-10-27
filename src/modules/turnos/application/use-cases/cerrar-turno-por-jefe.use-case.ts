import { Inject, Injectable } from '@nestjs/common';
import { Turno } from '../../domain/entities/turno.entity';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { turnoError } from '../turno.errors';

const ROLES_CIERRE = ['JEFE_TURNO', 'ADMIN'];
const LARGO_MAXIMO_MOTIVO = 100;

export interface CerrarTurnoPorJefeDto {
  rol: string;
  idUsuario?: number;
  idMaquina: unknown;
  horometroFinal: unknown;
  motivo: unknown;
}

/**
 * El jefe de turno cierra el turno en curso de una máquina en nombre del operador, para poder sacarla de
 * operación (falla, mantención) o reemplazarla. Pide el horómetro final: un cierre sin él dejaría las horas de la
 * máquina sin justificar. La app del operador se entera al sincronizar y le muestra quién lo cerró y por qué.
 */
@Injectable()
export class CerrarTurnoPorJefeUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
  ) {}

  async execute(dto: CerrarTurnoPorJefeDto, ahora: Date = new Date()): Promise<Turno> {
    if (!ROLES_CIERRE.includes(dto.rol) || !dto.idUsuario) throw turnoError('SIN_PERMISO_CIERRE');

    const motivo = typeof dto.motivo === 'string' ? dto.motivo.trim() : '';
    if (!motivo || motivo.length > LARGO_MAXIMO_MOTIVO) throw turnoError('MOTIVO_INVALIDO');

    const idMaquina = Number(dto.idMaquina);
    const turno = Number.isInteger(idMaquina) && idMaquina > 0 ? await this.turnoRepo.findActivoByMaquina(idMaquina) : null;
    if (!turno) throw turnoError('SIN_TURNO_EN_CURSO');

    const horometro = typeof dto.horometroFinal === 'number' ? dto.horometroFinal : Number.NaN;
    if (!Number.isFinite(horometro) || horometro < turno.horometroInicial) throw turnoError('HOROMETRO_INVALIDO');

    turno.cerrarPorJefe(ahora, horometro, dto.idUsuario, motivo);
    // El operador u otro jefe de turno lo cerró mientras tanto: gana el primer cierre
    const cerrado = await this.turnoRepo.cerrar(turno, false);
    if (!cerrado) throw turnoError('SIN_TURNO_EN_CURSO');
    return cerrado;
  }
}
