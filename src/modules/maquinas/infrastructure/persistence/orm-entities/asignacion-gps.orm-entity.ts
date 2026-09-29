import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('asignacion_gps')
export class AsignacionGpsOrmEntity {
  @Column('integer', { name: 'id_asignacion' })
  id_asignacion: number;

  @Column('integer', { name: 'id_gps' })
  id_gps: number;

  @Column('integer', { name: 'id_maquina' })
  id_maquina: number;

  @Column('timestamp with time zone', { name: 'vigente_desde' })
  vigente_desde: Date;

  @Column('timestamp with time zone', { name: 'vigente_hasta', nullable: true })
  vigente_hasta: Date | null;

}
