import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('auditoria_geocerca')
export class AuditoriaGeocercaOrmEntity {
  @Column('integer', { name: 'id_auditoria' })
  id_auditoria: number;

  @Column('varchar', { name: 'entidad' })
  entidad: string;

  @Column('integer', { name: 'id_entidad' })
  id_entidad: number;

  @Column('varchar', { name: 'accion' })
  accion: string;

  @Column('geometry', { name: 'poligono_anterior', nullable: true })
  poligono_anterior: string | null;

  @Column('integer', { name: 'id_usuario' })
  id_usuario: number;

  @Column('timestamp with time zone', { name: 'fecha' })
  fecha: Date;

}
