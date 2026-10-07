import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('modelo_maquina')
export class ModeloMaquinaOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_modelo' })
  id_modelo: number;

  @Column('varchar', { name: 'nombre' })
  nombre: string;

  @Column('varchar', { name: 'marca' })
  marca: string;

  @Column('varchar', { name: 'modelo' })
  modelo: string;

  @Column('varchar', { name: 'tipo_maquina' })
  tipo_maquina: string;

  @Column('boolean', { name: 'activo', default: true })
  activo: boolean;

  @Column('timestamp with time zone', { name: 'creado_en' })
  creado_en: Date;
}
