import { Injectable, Inject } from '@nestjs/common';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { IniciarTurnoDto } from '../dtos/iniciar-turno.dto';
import { Turno } from '../../domain/entities/turno.entity';

@Injectable()
export class IniciarTurnoUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
  ) {}

  async execute(dto: IniciarTurnoDto): Promise<Turno> {
    const turnoExistenteMaquina = await this.turnoRepo.findActivoByMaquina(dto.idMaquina);
    if (turnoExistenteMaquina) {
      throw new Error('La máquina ya tiene un turno activo');
    }

    const turnoExistenteOperador = await this.turnoRepo.findActivoByOperador(dto.idOperador);
    if (turnoExistenteOperador) {
      throw new Error('El operador ya tiene un turno activo');
    }

    const nuevoTurno = new Turno(
      null, // DB autogenerates id_turno
      dto.idOperador,
      dto.idMaquina,
      new Date(),
      null,
      dto.horometroInicial,
      null,
      'EN_CURSO',
    );

    const guardado = await this.turnoRepo.save(nuevoTurno);
    return guardado;
  }
}
