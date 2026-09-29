import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TurnoOrmEntity } from './turno.orm-entity';

@Entity('turno_estados')
export class TurnoEstadoOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  id_turno: string;

  @ManyToOne(() => TurnoOrmEntity)
  @JoinColumn({ name: 'id_turno' })
  turno: TurnoOrmEntity;

  @Column('varchar')
  id_estado_operacional: string;

  @Column('timestamp')
  fecha_inicio: Date;

  @Column('timestamp', { nullable: true })
  fecha_fin: Date | null;
}
