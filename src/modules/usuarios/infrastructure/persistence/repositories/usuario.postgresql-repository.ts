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

  async findByEmail(email: string): Promise<{ idUsuario: number; rol: string; passwordHash: string | null; idOperador: number | null } | null> {
    const usuario = await this.ormRepo.findOne({ where: { email, activo: true } });
    if (!usuario) return null;
    return {
      idUsuario: usuario.id_usuario,
      rol: usuario.rol,
      passwordHash: usuario.password_hash,
      idOperador: usuario.id_operador,
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

  async findById(idUsuario: number): Promise<{ idUsuario: number; rol: string; idOperador: number | null } | null> {
    const usuario = await this.ormRepo.findOne({ where: { id_usuario: idUsuario, activo: true } });
    if (!usuario) return null;
    return {
      idUsuario: usuario.id_usuario,
      rol: usuario.rol,
      idOperador: usuario.id_operador,
    };
  }

  async create(data: { email: string; nombre: string; rol: string; proveedorAuth: string; activo: boolean; idOperador: number | null; passwordHash: string | null }): Promise<number> {
    const entity = this.ormRepo.create({
      email: data.email,
      nombre: data.nombre,
      rol: data.rol,
      proveedor_auth: data.proveedorAuth,
      activo: data.activo,
      id_operador: data.idOperador,
      password_hash: data.passwordHash,
      creado_en: new Date(),
    });
    const saved = await this.ormRepo.save(entity);
    return saved.id_usuario;
  }
}
