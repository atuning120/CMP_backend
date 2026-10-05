import { Injectable, Inject } from '@nestjs/common';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { TURNO_ESTADO_REPOSITORY } from '../../domain/repositories/turno-estado.repository.port';
import type { TurnoEstadoRegistro, TurnoEstadoRepositoryPort } from '../../domain/repositories/turno-estado.repository.port';
import { RegistrarEstadoDto } from '../dtos/registrar-estado.dto';
import { turnoError } from '../turno.errors';
import { fechaDelEvento, validarIdCliente } from '../datos-cliente';
import { buscarTurnoDelOperador } from './finalizar-turno.use-case';

/**
 * Registra un cambio de estado operacional (producción, colación, falla...). El estado anterior
 * vigente se cierra en el momento en que empieza el nuevo.
 */
@Injectable()
export class RegistrarEstadoUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
    @Inject(TURNO_ESTADO_REPOSITORY)
    private readonly turnoEstadoRepo: TurnoEstadoRepositoryPort,
  ) {}

  async execute(dto: RegistrarEstadoDto, ahora: Date = new Date()): Promise<TurnoEstadoRegistro> {
    const idCliente = validarIdCliente(dto.idCliente);
    if (!idCliente) throw turnoError('ID_CLIENTE_INVALIDO');

    const turno = await buscarTurnoDelOperador(this.turnoRepo, dto.idOperador, dto);

    const existente = await this.turnoEstadoRepo.findByIdCliente(idCliente);
    if (existente) {
      if (existente.idTurno !== turno.id) throw turnoError('ID_CLIENTE_INVALIDO');
      return existente;
    }

    const estado = Number.isInteger(dto.idEstado) ? await this.turnoEstadoRepo.findEstadoById(dto.idEstado) : null;
    if (!estado) throw turnoError('ESTADO_NO_DISPONIBLE');

    const inicio = fechaDelEvento(dto.inicio, ahora);
    if (inicio.getTime() < turno.fechaInicio.getTime()) throw turnoError('FECHA_INVALIDA');
    // Un cambio registrado offline puede llegar después del cierre: se acepta si ocurrió durante el turno
    if (turno.fechaFin && inicio.getTime() >= turno.fechaFin.getTime()) throw turnoError('TURNO_NO_ACTIVO');

    return this.turnoEstadoRepo.registrarCambio({
      idTurno: turno.id!,
      idEstado: estado.idEstado,
      inicio,
      fin: turno.fechaFin,
      comentario: dto.comentario?.trim() || null,
      idCliente,
    });
  }
}
