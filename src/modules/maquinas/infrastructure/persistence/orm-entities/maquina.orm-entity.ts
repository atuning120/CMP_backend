import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('maquina')
export class MaquinaOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_maquina' })
  id_maquina: number;

  @Column('varchar', { name: 'nombre' })
  nombre: string;

  @Column('varchar', { name: 'marca', nullable: true })
  marca: string | null;

  @Column('varchar', { name: 'modelo', nullable: true })
  modelo: string | null;

  @Column('integer', { name: 'anio', nullable: true })
  anio: number | null;

  @Column('varchar', { name: 'tipo_maquina', nullable: true })
  tipo_maquina: string | null;

  @Column('varchar', { name: 'estado', nullable: true })
  estado: string | null;

  @Column('varchar', { name: 'patente', nullable: true })
  patente: string | null;

  @Column('varchar', { name: 'numero_chasis', nullable: true })
  numero_chasis: string | null;

  @Column('numeric', { name: 'horometro_inicial', nullable: true })
  horometro_inicial: string | null;

  @Column('boolean', { name: 'es_contratista', default: false })
  es_contratista: boolean;

}
