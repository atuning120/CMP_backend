import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('estado_operacional')
export class EstadoOperacionalOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_estado' })
  id_estado: number;

  @Column('varchar', { name: 'nombre' })
  nombre: string;

  @Column('varchar', { name: 'categoria', nullable: true })
  categoria: string | null;

  @Column('boolean', { name: 'es_productivo' })
  es_productivo: boolean;

  @Column('boolean', { name: 'activo' })
  activo: boolean;

  @Column('text', { name: 'descripcion', nullable: true })
  descripcion: string | null;

}
