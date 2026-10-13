import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioOrmEntity } from '../orm-entities/usuario.orm-entity';
import type {
  CuentaMicrosoftRepositoryPort,
  UsuarioCuentaMicrosoft,
  UsuarioRepositoryPort,
} from '../../../domain/repositories/usuario.repository.port';

@Injectable()
export class UsuarioPostgresqlRepository implements UsuarioRepositoryPort, CuentaMicrosoftRepositoryPort {
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

  async findByEntraOid(oid: string): Promise<UsuarioCuentaMicrosoft | null> {
    const usuario = await this.ormRepo
      .createQueryBuilder('u')
      .addSelect('u.entra_oid')
      .where('u.entra_oid = :oid', { oid })
      .getOne();
    return usuario ? this.mapCuenta(usuario) : null;
  }

  async findByEmailCualquierEstado(email: string): Promise<UsuarioCuentaMicrosoft | null> {
    // Mismo criterio que el índice único: el correo se compara sin distinguir mayúsculas
    const usuario = await this.ormRepo
      .createQueryBuilder('u')
      .addSelect('u.entra_oid')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
    return usuario ? this.mapCuenta(usuario) : null;
  }

  async vincularEntraOid(idUsuario: number, oid: string): Promise<void> {
    await this.ormRepo.update({ id_usuario: idUsuario }, { entra_oid: oid });
  }

  async crearDesdeMicrosoft(datos: { email: string; nombre: string; oid: string }): Promise<UsuarioCuentaMicrosoft> {
    const saved = await this.ormRepo.save(
      this.ormRepo.create({
        email: datos.email,
        nombre: datos.nombre,
        rol: 'VISOR',
        proveedor_auth: 'MICROSOFT',
        activo: true,
        id_operador: null,
        password_hash: null,
        entra_oid: datos.oid,
        creado_en: new Date(),
      }),
    );
    return this.mapCuenta(saved);
  }

  private mapCuenta(usuario: UsuarioOrmEntity): UsuarioCuentaMicrosoft {
    return {
      idUsuario: usuario.id_usuario,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      activo: usuario.activo,
      entraOid: usuario.entra_oid,
    };
  }
}
