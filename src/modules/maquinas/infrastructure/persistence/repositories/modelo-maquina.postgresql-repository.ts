import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ModeloMaquina, ModeloMaquinaRepositoryPort } from '../../../domain/repositories/modelo-maquina.repository.port';
import { ModeloMaquinaOrmEntity } from '../orm-entities/modelo-maquina.orm-entity';

@Injectable()
export class ModeloMaquinaPostgresqlRepository implements ModeloMaquinaRepositoryPort {
  constructor(
    @InjectRepository(ModeloMaquinaOrmEntity)
    private readonly ormRepository: Repository<ModeloMaquinaOrmEntity>,
  ) {}

  async findActivos(): Promise<ModeloMaquina[]> {
    const ormEntities = await this.ormRepository.find({
      where: { activo: true },
      order: { tipo_maquina: 'ASC', nombre: 'ASC' },
    });
    return ormEntities.map((ormEntity) => ({
      idModelo: ormEntity.id_modelo,
      nombre: ormEntity.nombre,
      marca: ormEntity.marca,
      modelo: ormEntity.modelo,
      tipoMaquina: ormEntity.tipo_maquina,
    }));
  }

  async crearSiNoExiste(datos: Omit<ModeloMaquina, 'idModelo'>): Promise<void> {
    await this.ormRepository
      .createQueryBuilder()
      .insert()
      .values({ nombre: datos.nombre, marca: datos.marca, modelo: datos.modelo, tipo_maquina: datos.tipoMaquina })
      .orIgnore()
      .execute();
  }
}
