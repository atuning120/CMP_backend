import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { VersionApp, VersionAppRepositoryPort } from '../../domain/repositories/version-app.repository.port';

interface FilaVersion {
  id_version_app: number;
  version: string;
  notas: string;
  archivo: string;
  tamano_bytes: string | number; // BIGINT llega como texto
  publicada: boolean;
  subida_en: Date;
  subida_por: string | null;
}

const COLUMNAS = `v.id_version_app, v.version, v.notas, v.archivo, v.tamano_bytes, v.publicada, v.subida_en, u.nombre AS subida_por`;

const aVersion = (f: FilaVersion): VersionApp => ({
  idVersion: f.id_version_app,
  version: f.version,
  notas: f.notas,
  archivo: f.archivo,
  tamanoBytes: Number(f.tamano_bytes),
  publicada: f.publicada,
  subidaEn: f.subida_en,
  subidaPor: f.subida_por,
});

// TypeORM entrega un UPDATE/DELETE ... RETURNING de Postgres como [filas, cantidad]; un INSERT, como la lista de filas
const filasDe = (resultado: unknown) =>
  (Array.isArray(resultado) && Array.isArray(resultado[0]) ? resultado[0] : resultado) as { id_version_app: number; archivo?: string }[];

const esVersionDuplicada = (error: unknown) => {
  const e = error as { code?: string; driverError?: { code?: string } };
  return (e?.code ?? e?.driverError?.code) === '23505';
};

// Tabla VERSION_APP (migración 023). La versión se ordena por sus números (1.10.0 después de 1.9.0)
@Injectable()
export class VersionAppPostgresqlRepository implements VersionAppRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async listar(soloPublicadas: boolean): Promise<VersionApp[]> {
    const filas: FilaVersion[] = await this.dataSource.query(
      `SELECT ${COLUMNAS}
         FROM version_app v
         LEFT JOIN usuario u ON u.id_usuario = v.subida_por
        WHERE v.publicada OR NOT $1
        ORDER BY string_to_array(v.version, '.')::int[] DESC`,
      [soloPublicadas],
    );
    return filas.map(aVersion);
  }

  async buscar(idVersion: number): Promise<VersionApp | null> {
    const [fila]: FilaVersion[] = await this.dataSource.query(
      `SELECT ${COLUMNAS} FROM version_app v LEFT JOIN usuario u ON u.id_usuario = v.subida_por WHERE v.id_version_app = $1`,
      [idVersion],
    );
    return fila ? aVersion(fila) : null;
  }

  async existeVersion(version: string): Promise<boolean> {
    const [fila]: { existe: boolean }[] = await this.dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM version_app WHERE version = $1) AS existe`,
      [version],
    );
    return fila.existe;
  }

  async crear(datos: { version: string; notas: string; archivo: string; tamanoBytes: number; idUsuario: number }): Promise<VersionApp | null> {
    try {
      const filas = filasDe(
        await this.dataSource.query(
          `INSERT INTO version_app (version, notas, archivo, tamano_bytes, subida_por)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id_version_app`,
          [datos.version, datos.notas, datos.archivo, datos.tamanoBytes, datos.idUsuario],
        ),
      );
      return this.buscar(filas[0].id_version_app);
    } catch (error) {
      if (esVersionDuplicada(error)) return null;
      throw error;
    }
  }

  async actualizar(idVersion: number, cambios: { notas?: string; publicada?: boolean }): Promise<VersionApp | null> {
    const filas = filasDe(
      await this.dataSource.query(
        `UPDATE version_app
            SET notas = COALESCE($2, notas), publicada = COALESCE($3, publicada)
          WHERE id_version_app = $1
          RETURNING id_version_app`,
        [idVersion, cambios.notas ?? null, cambios.publicada ?? null],
      ),
    );
    return filas.length ? this.buscar(idVersion) : null;
  }

  async eliminar(idVersion: number): Promise<VersionApp | null> {
    const actual = await this.buscar(idVersion);
    if (!actual) return null;
    const filas = filasDe(await this.dataSource.query(`DELETE FROM version_app WHERE id_version_app = $1 RETURNING id_version_app`, [idVersion]));
    return filas.length ? actual : null;
  }
}
