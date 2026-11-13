import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioOrmEntity } from '../orm-entities/usuario.orm-entity';
import type { RecorridosRepositoryPort } from '../../../domain/repositories/recorridos.repository.port';

// Tope de recorridos guardados por usuario: cada rol y versión suma uno, así que nunca debería acercarse
const MAXIMO_RECORRIDOS = 50;

/**
 * USUARIO.recorridos_vistos (migración 019) se lee con SQL propio y no está en UsuarioOrmEntity: así el resto de las
 * consultas de usuario (login incluido) no depende de que la migración ya esté aplicada
 */
@Injectable()
export class RecorridosPostgresqlRepository implements RecorridosRepositoryPort {
  constructor(
    @InjectRepository(UsuarioOrmEntity)
    private readonly ormRepo: Repository<UsuarioOrmEntity>,
  ) {}

  async vistos(idUsuario: number): Promise<string[] | null> {
    const [fila]: { recorridos_vistos: string[] }[] = await this.ormRepo.query(
      `SELECT recorridos_vistos FROM usuario WHERE id_usuario = $1`,
      [idUsuario],
    );
    return fila ? fila.recorridos_vistos : null;
  }

  async marcarVisto(idUsuario: number, recorrido: string): Promise<string[] | null> {
    // Un solo UPDATE: dos pestañas que terminan el recorrido a la vez no lo duplican
    const resultado: unknown = await this.ormRepo.query(
      `UPDATE usuario
          SET recorridos_vistos = CASE
                WHEN $2 = ANY(recorridos_vistos) OR cardinality(recorridos_vistos) >= $3 THEN recorridos_vistos
                ELSE array_append(recorridos_vistos, $2::text)
              END
        WHERE id_usuario = $1
        RETURNING recorridos_vistos`,
      [idUsuario, recorrido, MAXIMO_RECORRIDOS],
    );
    // TypeORM entrega un UPDATE de Postgres como [filas, cantidad]; se acepta también la lista de filas sola
    const filas = (Array.isArray(resultado) && Array.isArray(resultado[0]) ? resultado[0] : resultado) as
      | { recorridos_vistos: string[] }[]
      | undefined;
    return filas?.[0]?.recorridos_vistos ?? null;
  }
}
