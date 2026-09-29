import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('reporte_turno')
export class ReporteTurnoOrmEntity {
  @Column('integer', { name: 'id_reporte' })
  id_reporte: number;

  @Column('integer', { name: 'id_turno' })
  id_turno: number;

  @Column('varchar', { name: 'tipo', nullable: true })
  tipo: string | null;

  @Column('text', { name: 'descripcion', nullable: true })
  descripcion: string | null;

  @Column('timestamp with time zone', { name: 'fecha_hora' })
  fecha_hora: Date;

  @Column('varchar', { name: 'estado_sincronizacion', nullable: true })
  estado_sincronizacion: string | null;

}
