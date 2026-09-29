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

  async save(turno: Turno): Promise<void> {
    const ormEntity = this.ormRepository.create({
      id: turno.id,
      id_operador: turno.idOperador,
      id_maquina: turno.idMaquina,
      fecha_inicio: turno.fechaInicio,
      fecha_fin: turno.fechaFin,
      horometro_inicial: turno.horometroInicial,
      horometro_final: turno.horometroFinal,
      estado_actual: turno.estadoActual,
    });
    await this.ormRepository.save(ormEntity);
  }

  async findById(id: string): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async findActivoByMaquina(idMaquina: string): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id_maquina: idMaquina, fecha_fin: IsNull() },
    });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async findActivoByOperador(idOperador: string): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id_operador: idOperador, fecha_fin: IsNull() },
    });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  private mapToDomain(ormEntity: TurnoOrmEntity): Turno {
    return new Turno(
      ormEntity.id,
      ormEntity.id_operador,
      ormEntity.id_maquina,
      ormEntity.fecha_inicio,
      ormEntity.fecha_fin,
      ormEntity.horometro_inicial,
      ormEntity.horometro_final,
      ormEntity.estado_actual,
    );
  }
}
