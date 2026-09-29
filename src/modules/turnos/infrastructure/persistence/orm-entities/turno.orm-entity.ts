import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('turnos')
export class TurnoOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  id_operador: string;

  @Column('uuid')
  id_maquina: string;

  @Column('timestamp')
  fecha_inicio: Date;

  @Column('timestamp', { nullable: true })
  fecha_fin: Date | null;

  @Column('float')
  horometro_inicial: number;

  @Column('float', { nullable: true })
  horometro_final: number | null;

  @Column('varchar')
  estado_actual: string;
}
