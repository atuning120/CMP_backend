import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('refresh_token')
export class RefreshTokenOrmEntity {
  @PrimaryGeneratedColumn({ name: 'id_refresh_token' })
  id_refresh_token: number;

  @Column('integer', { name: 'id_usuario' })
  id_usuario: number;

  @Column('char', { name: 'token_hash', length: 64 })
  token_hash: string;

  @Column('timestamp with time zone', { name: 'creado_en' })
  creado_en: Date;

  @Column('timestamp with time zone', { name: 'expira_en' })
  expira_en: Date;

  @Column('timestamp with time zone', { name: 'revocado_en', nullable: true })
  revocado_en: Date | null;
}
