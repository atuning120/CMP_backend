import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('operador')
export class OperadorOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_operador' })
  id_operador: number;

  @Column('varchar', { name: 'nombre' })
  nombre: string;

  @Column('varchar', { name: 'apellido' })
  apellido: string;

  @Column('varchar', { name: 'rut' })
  rut: string;

  @Column('varchar', { name: 'telefono', nullable: true })
  telefono: string | null;

  @Column('varchar', { name: 'estado', nullable: true })
  estado: string | null;

}
