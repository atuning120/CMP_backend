import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioOrmEntity } from '../orm-entities/usuario.orm-entity';
import { AdminPrincipalConfig } from '../../../application/admin-principal';
import type {
  CambiosUsuario,
  CuentaMicrosoftRepositoryPort,
  FichaOperador,
  GestionUsuariosRepositoryPort,
  NuevoUsuario,
  UsuarioAdministrable,
  UsuarioCuentaMicrosoft,
  UsuarioRepositoryPort,
} from '../../../domain/repositories/usuario.repository.port';

@Injectable()
export class UsuarioPostgresqlRepository
  implements UsuarioRepositoryPort, CuentaMicrosoftRepositoryPort, GestionUsuariosRepositoryPort
{
  constructor(
    @InjectRepository(UsuarioOrmEntity)
    private readonly ormRepo: Repository<UsuarioOrmEntity>,
    private readonly principal: AdminPrincipalConfig,
  ) {}

  async findByEmail(email: string): Promise<{ idUsuario: number; rol: string; passwordHash: string | null; idOperador: number | null; nombre: string; email: string } | null> {
    // Sin distinguir mayúsculas: "Ana.Rojas@cmp.cl" entra a la misma cuenta que "ana.rojas@cmp.cl"
    const usuario = await this.ormRepo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .andWhere('u.activo = true')
      .getOne();
    if (!usuario) return null;
    return {
      idUsuario: usuario.id_usuario,
      rol: usuario.rol,
      passwordHash: usuario.password_hash,
      idOperador: usuario.id_operador,
      nombre: usuario.nombre,
      email: usuario.email,
    };
  }

  async findByIdOperador(idOperador: number): Promise<{ idUsuario: number; rol: string; passwordHash: string | null; nombre: string; email: string } | null> {
    const usuario = await this.ormRepo.findOne({ where: { id_operador: idOperador, activo: true } });
    if (!usuario) return null;
    return {
      idUsuario: usuario.id_usuario,
      rol: usuario.rol,
      passwordHash: usuario.password_hash,
      nombre: usuario.nombre,
      email: usuario.email,
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

  async listar(): Promise<UsuarioAdministrable[]> {
    const usuarios = await this.ormRepo.find({ order: { activo: 'DESC', nombre: 'ASC' } });
    const fichas = await this.fichasOperador(usuarios.map((u) => u.id_operador));
    return usuarios.map((u) => this.mapAdministrable(u, fichas));
  }

  async findAdministrable(idUsuario: number): Promise<UsuarioAdministrable | null> {
    const usuario = await this.ormRepo.findOne({ where: { id_usuario: idUsuario } });
    return usuario ? this.mapAdministrable(usuario, await this.fichasOperador([usuario.id_operador])) : null;
  }

  async findAdministrablePorEmail(email: string): Promise<UsuarioAdministrable | null> {
    const usuario = await this.ormRepo.createQueryBuilder('u').where('LOWER(u.email) = LOWER(:email)', { email }).getOne();
    return usuario ? this.mapAdministrable(usuario, await this.fichasOperador([usuario.id_operador])) : null;
  }

  async passwordHashDe(idUsuario: number): Promise<string | null> {
    const usuario = await this.ormRepo.findOne({ where: { id_usuario: idUsuario }, select: { id_usuario: true, password_hash: true } });
    return usuario?.password_hash ?? null;
  }

  async contarAdminsActivos(): Promise<number> {
    return this.ormRepo.count({ where: { rol: 'ADMIN', activo: true } });
  }

  async cambiarRol(idUsuario: number, rol: string): Promise<void> {
    await this.ormRepo.update({ id_usuario: idUsuario }, { rol });
  }

  async existeEmail(email: string, exceptoIdUsuario = 0): Promise<boolean> {
    return this.ormRepo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .andWhere('u.id_usuario <> :excepto', { excepto: exceptoIdUsuario })
      .getExists();
  }

  async existeRut(rut: string, exceptoIdOperador = 0): Promise<boolean> {
    const filas: unknown[] = await this.ormRepo.query(
      `SELECT 1 FROM operador
       WHERE UPPER(REGEXP_REPLACE(rut, '[.\\s-]', '', 'g')) = UPPER(REGEXP_REPLACE($1, '[.\\s-]', '', 'g'))
         AND id_operador <> $2
       LIMIT 1`,
      [rut, exceptoIdOperador],
    );
    return filas.length > 0;
  }

  async crear(datos: NuevoUsuario): Promise<number> {
    return this.ormRepo.manager.transaction(async (manager) => {
      let idOperador: number | null = null;
      if (datos.operador) {
        const { nombre, apellido, rut, telefono } = datos.operador;
        const [fila]: { id_operador: number }[] = await manager.query(
          `INSERT INTO operador (nombre, apellido, rut, telefono, estado) VALUES ($1, $2, $3, $4, 'ACTIVO') RETURNING id_operador`,
          [nombre, apellido, rut, telefono],
        );
        idOperador = fila.id_operador;
      }
      const saved = await manager.getRepository(UsuarioOrmEntity).save(
        manager.getRepository(UsuarioOrmEntity).create({
          email: datos.email,
          nombre: datos.nombre,
          rol: datos.rol,
          proveedor_auth: datos.proveedorAuth,
          activo: true,
          id_operador: idOperador,
          password_hash: datos.passwordHash,
          creado_en: new Date(),
        }),
      );
      return saved.id_usuario;
    });
  }

  async cambiarActivo(idUsuario: number, activo: boolean): Promise<void> {
    await this.ormRepo.update({ id_usuario: idUsuario }, { activo });
  }

  async actualizar(idUsuario: number, { email, nombre, acceso, operador }: CambiosUsuario): Promise<void> {
    await this.ormRepo.manager.transaction(async (manager) => {
      await manager.getRepository(UsuarioOrmEntity).update(
        { id_usuario: idUsuario },
        { email, nombre, ...(acceso ? { proveedor_auth: acceso.proveedorAuth, password_hash: acceso.passwordHash } : {}) },
      );
      if (operador) {
        await manager.query(`UPDATE operador SET nombre = $2, apellido = $3, rut = $4, telefono = $5 WHERE id_operador = $1`, [
          operador.idOperador,
          operador.nombre,
          operador.apellido,
          operador.rut,
          operador.telefono,
        ]);
      }
      if (acceso) {
        await manager.query(`UPDATE refresh_token SET revocado_en = NOW() WHERE id_usuario = $1 AND revocado_en IS NULL`, [idUsuario]);
      }
    });
  }

  private async fichasOperador(ids: (number | null)[]): Promise<Map<number, FichaOperador & { idOperador: number }>> {
    const conFicha = ids.filter((id): id is number => id !== null);
    if (conFicha.length === 0) return new Map();
    const filas: { id_operador: number; nombre: string; apellido: string; rut: string; telefono: string | null }[] = await this.ormRepo.query(
      `SELECT id_operador, nombre, apellido, rut, telefono FROM operador WHERE id_operador = ANY($1::int[])`,
      [conFicha],
    );
    return new Map(
      filas.map((f) => [f.id_operador, { idOperador: f.id_operador, nombre: f.nombre, apellido: f.apellido, rut: f.rut, telefono: f.telefono }]),
    );
  }

  private mapAdministrable(usuario: UsuarioOrmEntity, fichas: Map<number, FichaOperador & { idOperador: number }>): UsuarioAdministrable {
    return {
      idUsuario: usuario.id_usuario,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      proveedorAuth: usuario.proveedor_auth,
      activo: usuario.activo,
      creadoEn: usuario.creado_en,
      esOperador: usuario.id_operador !== null,
      operador: usuario.id_operador !== null ? (fichas.get(usuario.id_operador) ?? null) : null,
      esPrincipal: this.principal.es(usuario.email),
    };
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
