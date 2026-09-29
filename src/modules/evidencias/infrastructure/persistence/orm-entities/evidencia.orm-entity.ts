import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('evidencia')
export class EvidenciaOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_evidencia' })
  id_evidencia: number;

  @Column('integer', { name: 'id_reporte' })
  id_reporte: number;

  @Column('text', { name: 'url_blob' })
  url_blob: string;

  @Column('timestamp with time zone', { name: 'fecha_hora' })
  fecha_hora: Date;

  @Column('varchar', { name: 'estado_sincronizacion', nullable: true })
  estado_sincronizacion: string | null;

}
