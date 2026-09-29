import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tracking_history')
export class TrackingHistoryOrmEntity {
  @Column('bigint', { name: 'id_history' })
  id_history: number;

  @Column('timestamp with time zone', { name: 'timestamp' })
  timestamp: Date;

  @Column('integer', { name: 'id_gps' })
  id_gps: number;

  @Column('integer', { name: 'id_maquina' })
  id_maquina: number;

  @Column('geometry', { name: 'ubicacion', nullable: true })
  ubicacion: string | null;

  @Column('numeric', { name: 'velocidad', nullable: true })
  velocidad: number | null;

  @Column('numeric', { name: 'heading', nullable: true })
  heading: number | null;

  @Column('numeric', { name: 'nivel_bateria', nullable: true })
  nivel_bateria: number | null;

  @Column('jsonb', { name: 'payload_crudo', nullable: true })
  payload_crudo: any | null;

}
