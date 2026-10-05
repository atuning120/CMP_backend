import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MaquinaRepositoryPort, MaquinaResumen } from '../../../domain/repositories/maquina.repository.port';
import { MaquinaOrmEntity } from '../orm-entities/maquina.orm-entity';

@Injectable()
export class MaquinaPostgresqlRepository implements MaquinaRepositoryPort {
  constructor(
    @InjectRepository(MaquinaOrmEntity)
    private readonly ormRepository: Repository<MaquinaOrmEntity>,
  ) {}

  async findById(idMaquina: number): Promise<MaquinaResumen | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id_maquina: idMaquina } });
    if (!ormEntity) return null;
    return this.mapToResumen(ormEntity);
  }

  async findActivas(): Promise<MaquinaResumen[]> {
    const ormEntities = await this.ormRepository.find({
      where: { estado: 'ACTIVA' },
      order: { nombre: 'ASC' },
    });
    return ormEntities.map((ormEntity) => this.mapToResumen(ormEntity));
  }

  private mapToResumen(ormEntity: MaquinaOrmEntity): MaquinaResumen {
    return {
      idMaquina: ormEntity.id_maquina,
      nombre: ormEntity.nombre,
      marca: ormEntity.marca,
      modelo: ormEntity.modelo,
      tipoMaquina: ormEntity.tipo_maquina,
      estado: ormEntity.estado,
    };
  }
}
