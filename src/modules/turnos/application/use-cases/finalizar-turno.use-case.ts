import { Injectable, Inject } from '@nestjs/common';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { FinalizarTurnoDto } from '../dtos/finalizar-turno.dto';

@Injectable()
export class FinalizarTurnoUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
  ) {}

  async execute(dto: FinalizarTurnoDto): Promise<void> {
    const turno = await this.turnoRepo.findById(dto.idTurno);
    if (!turno) {
      throw new Error('Turno no encontrado');
    }

    turno.finalizar(new Date(), dto.horometroFinal);
    await this.turnoRepo.save(turno);
  }
}
