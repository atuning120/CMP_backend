import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('alerta')
export class AlertaOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_alerta' })
  id_alerta: number;

  @Column('integer', { name: 'id_gps' })
  id_gps: number;

  @Column('integer', { name: 'id_maquina' })
  id_maquina: number;

  @Column('varchar', { name: 'tipo' })
  tipo: string;

  @Column('timestamp with time zone', { name: 'fecha' })
  fecha: Date;

  @Column('text', { name: 'detalle', nullable: true })
  detalle: string | null;

  @Column('boolean', { name: 'atendida', nullable: true })
  atendida: boolean | null;

  @Column('integer', { name: 'atendida_por', nullable: true })
  atendida_por: number | null;

  @Column('timestamp with time zone', { name: 'atendida_en', nullable: true })
  atendida_en: Date | null;

}
