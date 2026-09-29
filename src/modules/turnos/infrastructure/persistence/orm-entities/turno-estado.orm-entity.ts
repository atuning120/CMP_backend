import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TurnoOrmEntity } from './turno.orm-entity';

@Entity('turno_estado')
export class TurnoEstadoOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_turno_estado' })
  id_turno_estado: number;

  @Column('integer', { name: 'id_turno' })
  id_turno: number;

  @ManyToOne(() => TurnoOrmEntity)
  @JoinColumn({ name: 'id_turno' })
  turno: TurnoOrmEntity;

  @Column('integer', { name: 'id_estado' })
  id_estado: number;

  @Column('timestamp with time zone', { name: 'inicio' })
  inicio: Date;

  @Column('timestamp with time zone', { name: 'fin', nullable: true })
  fin: Date | null;

  @Column('text', { name: 'comentario', nullable: true })
  comentario: string | null;
}
