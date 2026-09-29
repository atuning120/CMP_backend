import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import type { TurnoRepositoryPort } from '../../../domain/repositories/turno.repository.port';
import { Turno } from '../../../domain/entities/turno.entity';
import { TurnoOrmEntity } from '../orm-entities/turno.orm-entity';

@Injectable()
export class TurnoPostgresqlRepository implements TurnoRepositoryPort {
  constructor(
    @InjectRepository(TurnoOrmEntity)
    private readonly ormRepository: Repository<TurnoOrmEntity>,
  ) {}

  async save(turno: Turno): Promise<Turno> {
    const ormEntity = this.ormRepository.create({
      id_turno: turno.id ?? undefined, // Undefined lets TypeORM rely on DB defaults (nextval)
      id_operador: turno.idOperador,
      id_maquina: turno.idMaquina,
      fecha_turno: turno.fechaInicio, // Asumiendo fecha de inicio como fecha de turno para simplificar
      hora_inicio: turno.fechaInicio,
      hora_termino: turno.fechaFin,
      horometro_inicial: turno.horometroInicial,
      horometro_final: turno.horometroFinal,
      estado: turno.estadoActual,
    });
    const saved = await this.ormRepository.save(ormEntity);
    return this.mapToDomain(saved);
  }

  async findById(id: number): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id_turno: id } });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async findActivoByMaquina(idMaquina: number): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id_maquina: idMaquina, hora_termino: IsNull() },
    });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async findActivoByOperador(idOperador: number): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id_operador: idOperador, hora_termino: IsNull() },
    });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  private mapToDomain(ormEntity: TurnoOrmEntity): Turno {
    return new Turno(
      ormEntity.id_turno,
      ormEntity.id_operador,
      ormEntity.id_maquina,
      ormEntity.hora_inicio,
      ormEntity.hora_termino,
      Number(ormEntity.horometro_inicial),
      ormEntity.horometro_final ? Number(ormEntity.horometro_final) : null,
      ormEntity.estado,
    );
  }
}
