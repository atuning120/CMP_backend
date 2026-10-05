import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('zona_trabajo')
export class ZonaTrabajoOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_zona' })
  id_zona: number;

  @Column('integer', { name: 'id_area' })
  id_area: number;

  @Column('varchar', { name: 'nombre' })
  nombre: string;

  @Column('text', { name: 'descripcion', nullable: true })
  descripcion: string | null;

  @Column('geometry', { name: 'poligono', nullable: true })
  poligono: string | null;

  @Column('varchar', { name: 'estado', nullable: true })
  estado: string | null;

  @Column('timestamp with time zone', { name: 'creado_en' })
  creado_en: Date;

  @Column('timestamp with time zone', { name: 'modificado_en', nullable: true })
  modificado_en: Date | null;

  @Column('integer', { name: 'modificado_por', nullable: true })
  modificado_por: number | null;

}
