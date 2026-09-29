import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('dispositivo_gps')
export class DispositivoGpsOrmEntity {
  @Column('integer', { name: 'id_gps' })
  id_gps: number;

  @Column('varchar', { name: 'imei' })
  imei: string;

  @Column('varchar', { name: 'modelo', nullable: true })
  modelo: string | null;

  @Column('varchar', { name: 'numero_sim', nullable: true })
  numero_sim: string | null;

  @Column('varchar', { name: 'estado', nullable: true })
  estado: string | null;

}
