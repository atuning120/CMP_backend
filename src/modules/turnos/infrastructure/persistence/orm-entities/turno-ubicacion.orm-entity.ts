import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TurnoOrmEntity } from './turno.orm-entity';

@Entity('turno_ubicacion')
export class TurnoUbicacionOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_turno_ubicacion' })
  id_turno_ubicacion: number;

  @Column('integer', { name: 'id_turno' })
  id_turno: number;

  @ManyToOne(() => TurnoOrmEntity)
  @JoinColumn({ name: 'id_turno' })
  turno: TurnoOrmEntity;

  @Column('integer', { name: 'id_area' })
  id_area: number;

  @Column('integer', { name: 'id_zona', nullable: true })
  id_zona: number | null;

  @Column('timestamp with time zone', { name: 'inicio' })
  inicio: Date;

  @Column('timestamp with time zone', { name: 'fin', nullable: true })
  fin: Date | null;
}
