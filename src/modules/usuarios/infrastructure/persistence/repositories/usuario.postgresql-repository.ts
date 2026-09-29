import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioOrmEntity } from '../orm-entities/usuario.orm-entity';
import type { UsuarioRepositoryPort } from '../../../domain/repositories/usuario.repository.port';

@Injectable()
export class UsuarioPostgresqlRepository implements UsuarioRepositoryPort {
  constructor(
    @InjectRepository(UsuarioOrmEntity)
    private readonly ormRepo: Repository<UsuarioOrmEntity>,
  ) {}

  async findByEmail(email: string): Promise<{ idUsuario: number; rol: string; passwordHash: string | null } | null> {
    const usuario = await this.ormRepo.findOne({ where: { email, activo: true } });
    if (!usuario) return null;
    return {
      idUsuario: usuario.id_usuario,
      rol: usuario.rol,
      passwordHash: usuario.password_hash,
    };
  }

  async findByIdOperador(idOperador: number): Promise<{ idUsuario: number; rol: string; passwordHash: string | null } | null> {
    const usuario = await this.ormRepo.findOne({ where: { id_operador: idOperador, activo: true } });
    if (!usuario) return null;
    return {
      idUsuario: usuario.id_usuario,
      rol: usuario.rol,
      passwordHash: usuario.password_hash,
    };
  }
}
