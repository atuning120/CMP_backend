import { Injectable, Inject } from '@nestjs/common';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { FinalizarTurnoDto } from '../dtos/finalizar-turno.dto';
import { Turno } from '../../domain/entities/turno.entity';
import { turnoError } from '../turno.errors';
import { fechaDelEvento, validarIdCliente } from '../datos-cliente';

export const buscarTurnoDelOperador = async (
  turnoRepo: TurnoRepositoryPort,
  idOperador: number,
  ref: { idTurno?: number | null; idClienteTurno?: string | null },
): Promise<Turno> => {
  const idClienteTurno = validarIdCliente(ref.idClienteTurno);
  const turno = idClienteTurno
    ? await turnoRepo.findByIdCliente(idClienteTurno)
    : Number.isInteger(ref.idTurno)
      ? await turnoRepo.findById(ref.idTurno!)
      : null;
  // Un operador solo puede operar sobre sus propios turnos; no se revela si el turno existe para otro.
  if (!turno || turno.idOperador !== idOperador) {
    throw turnoError('TURNO_NO_ENCONTRADO');
  }
  return turno;
};

@Injectable()
export class FinalizarTurnoUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
  ) {}

  /**
   * Devuelve el turno cerrado. Si el cierre ocurrió después de las 12 h, el turno queda
   * CERRADO_AUTO (con el horómetro informado); la app lo distingue por `estadoActual`.
   */
  async execute(dto: FinalizarTurnoDto, ahora: Date = new Date()): Promise<Turno> {
    const turno = await buscarTurnoDelOperador(this.turnoRepo, dto.idOperador, dto);

    // Reintento de un cierre ya aplicado (o cierre automático que ya registró el horómetro)
    if (turno.estadoActual === 'CERRADO' || (turno.estadoActual === 'CERRADO_AUTO' && turno.horometroFinal !== null)) {
      return turno;
    }

    const fechaFin = fechaDelEvento(dto.fechaFin, ahora);
    if (!Number.isFinite(dto.horometroFinal) || dto.horometroFinal < turno.horometroInicial) {
      throw turnoError('HOROMETRO_INVALIDO');
    }
    if (fechaFin.getTime() < turno.fechaInicio.getTime()) {
      throw turnoError('FECHA_INVALIDA');
    }

    turno.finalizar(fechaFin, dto.horometroFinal);
    return this.turnoRepo.save(turno);
  }
}
