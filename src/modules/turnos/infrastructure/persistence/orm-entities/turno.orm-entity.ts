import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('turno')
export class TurnoOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_turno' })
  id_turno: number;

  @Column('integer', { name: 'id_operador' })
  id_operador: number;

  @Column('integer', { name: 'id_maquina' })
  id_maquina: number;

  @Column('date', { name: 'fecha_turno' })
  fecha_turno: Date;

  @Column('timestamp with time zone', { name: 'hora_inicio' })
  hora_inicio: Date;

  @Column('timestamp with time zone', { name: 'hora_termino', nullable: true })
  hora_termino: Date | null;

  @Column('numeric', { name: 'horometro_inicial' })
  horometro_inicial: number;

  @Column('numeric', { name: 'horometro_final', nullable: true })
  horometro_final: number | null;

  @Column('varchar', { name: 'estado', nullable: true })
  estado: string | null;

}
