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

  @Column('timestamp with time zone', { name: 'creado_en' })
  creado_en: Date;

  @Column('varchar', { name: 'password_hash', length: 255, nullable: true })
  password_hash: string | null;
}
