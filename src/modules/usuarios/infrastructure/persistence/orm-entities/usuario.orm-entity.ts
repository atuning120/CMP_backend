import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('usuario')
export class UsuarioOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_usuario' })
  id_usuario: number;

  @Column('varchar', { name: 'email' })
  email: string;

  @Column('varchar', { name: 'nombre' })
  nombre: string;

  @Column('varchar', { name: 'rol' })
  rol: string;

  @Column('varchar', { name: 'proveedor_auth' })
  proveedor_auth: string;

  @Column('boolean', { name: 'activo' })
  activo: boolean;

  @Column('integer', { name: 'id_operador', nullable: true })
  id_operador: number | null;

  // select: false -> solo la leen las consultas del login con Microsoft, que la piden explícitamente.
  // Así el resto de las consultas de usuario no depende de que la migración 007 ya esté aplicada
  @Column('varchar', { name: 'entra_oid', length: 64, nullable: true, select: false })
  entra_oid: string | null;

  @Column('timestamp with time zone', { name: 'creado_en' })
  creado_en: Date;

  @Column('varchar', { name: 'password_hash', length: 255, nullable: true })
  password_hash: string | null;
}
