import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperadorOrmEntity } from '../orm-entities/operador.orm-entity';
import type { OperadorRepositoryPort, PerfilOperador } from '../../../domain/repositories/operador.repository.port';

@Injectable()
export class OperadorPostgresqlRepository implements OperadorRepositoryPort {
  constructor(
    @InjectRepository(OperadorOrmEntity)
    private readonly ormRepo: Repository<OperadorOrmEntity>,
  ) {}

  async findByRut(rut: string): Promise<({ idOperador: number; estado: string } & PerfilOperador) | null> {
    const operador = await this.ormRepo.findOne({ where: { rut } });
    if (!operador) return null;
    return {
      idOperador: operador.id_operador,
      estado: operador.estado ?? 'ACTIVO',
      nombre: operador.nombre,
      apellido: operador.apellido,
      rut: operador.rut,
    };
  }

  async findPerfil(idOperador: number): Promise<PerfilOperador | null> {
    const operador = await this.ormRepo.findOne({ where: { id_operador: idOperador } });
    if (!operador) return null;
    return { nombre: operador.nombre, apellido: operador.apellido, rut: operador.rut };
  }

  async create(data: { nombre: string; apellido: string; rut: string; telefono: string; estado: string }): Promise<number> {
    const entity = this.ormRepo.create({
      nombre: data.nombre,
      apellido: data.apellido,
      rut: data.rut,
      telefono: data.telefono,
      estado: data.estado,
    });
    const saved = await this.ormRepo.save(entity);
    return saved.id_operador;
  }
}
