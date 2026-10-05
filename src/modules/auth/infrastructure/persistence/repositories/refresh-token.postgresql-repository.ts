import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type {
  RefreshTokenRegistro,
  RefreshTokenRepositoryPort,
} from '../../../domain/repositories/refresh-token.repository.port';
import { RefreshTokenOrmEntity } from '../orm-entities/refresh-token.orm-entity';

@Injectable()
export class RefreshTokenPostgresqlRepository implements RefreshTokenRepositoryPort {
  constructor(
    @InjectRepository(RefreshTokenOrmEntity)
    private readonly ormRepo: Repository<RefreshTokenOrmEntity>,
  ) {}

  async create(data: { idUsuario: number; tokenHash: string; expiraEn: Date }): Promise<void> {
    await this.ormRepo.insert({
      id_usuario: data.idUsuario,
      token_hash: data.tokenHash,
      expira_en: data.expiraEn,
      creado_en: new Date(),
      revocado_en: null,
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRegistro | null> {
    const registro = await this.ormRepo.findOne({ where: { token_hash: tokenHash } });
    if (!registro) return null;
    return {
      idRefreshToken: registro.id_refresh_token,
      idUsuario: registro.id_usuario,
      expiraEn: registro.expira_en,
      revocadoEn: registro.revocado_en,
    };
  }

  async revocar(idRefreshToken: number, fecha: Date): Promise<void> {
    await this.ormRepo.update({ id_refresh_token: idRefreshToken, revocado_en: IsNull() }, { revocado_en: fecha });
  }

  async revocarTodosDelUsuario(idUsuario: number, fecha: Date): Promise<void> {
    await this.ormRepo.update({ id_usuario: idUsuario, revocado_en: IsNull() }, { revocado_en: fecha });
  }
}
