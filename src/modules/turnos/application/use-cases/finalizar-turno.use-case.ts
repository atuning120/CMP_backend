import { Injectable, Inject } from '@nestjs/common';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { FinalizarTurnoDto } from '../dtos/finalizar-turno.dto';
import { Turno } from '../../domain/entities/turno.entity';
import { turnoError } from '../turno.errors';

@Injectable()
export class FinalizarTurnoUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
  ) {}

  async execute(dto: FinalizarTurnoDto): Promise<Turno> {
    const turno = await this.turnoRepo.findById(dto.idTurno);
    // Un operador solo puede cerrar sus propios turnos; no se revela si el turno existe para otro.
    if (!turno || turno.idOperador !== dto.idOperador) {
      throw turnoError('TURNO_NO_ENCONTRADO');
    }

    if (!turno.enCurso) {
      throw turnoError(turno.estadoActual === 'CERRADO_AUTO' ? 'TURNO_CERRADO_AUTOMATICAMENTE' : 'TURNO_NO_ACTIVO');
    }

    const ahora = new Date();
    if (turno.excedeDuracionMaxima(ahora)) {
      turno.cerrarAutomaticamente();
      await this.turnoRepo.save(turno);
      throw turnoError('TURNO_CERRADO_AUTOMATICAMENTE');
    }

    if (!Number.isFinite(dto.horometroFinal) || dto.horometroFinal < turno.horometroInicial) {
      throw turnoError('HOROMETRO_INVALIDO');
    }

    turno.finalizar(ahora, dto.horometroFinal);
    return this.turnoRepo.save(turno);
  }
}
