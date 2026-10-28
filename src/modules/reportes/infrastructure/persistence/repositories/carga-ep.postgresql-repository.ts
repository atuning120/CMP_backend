import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { CargaEp, CargaEpRepositoryPort, NuevaCargaEp } from '../../../domain/repositories/carga-ep.repository.port';

interface FilaCarga {
  id_carga: number;
  periodo: string;
  fecha_desde: string;
  fecha_hasta: string;
  archivo: string;
  filas: number;
  subido_por: string;
  subido_en: Date;
}

// Las fechas salen como texto: el driver convierte DATE a Date en la zona horaria del servidor y correría el día
const SELECT_CARGA = `
  SELECT c.id_carga, to_char(c.periodo, 'YYYY-MM') AS periodo, to_char(c.fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
         to_char(c.fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta, c.archivo, c.filas, u.nombre AS subido_por, c.subido_en
  FROM reportes.carga c
  JOIN usuario u ON u.id_usuario = c.subido_por`;

const aCarga = (f: FilaCarga): CargaEp => ({
  idCarga: f.id_carga,
  periodo: f.periodo,
  fechaDesde: f.fecha_desde,
  fechaHasta: f.fecha_hasta,
  archivo: f.archivo,
  filas: f.filas,
  subidoPor: f.subido_por,
  subidoEn: f.subido_en,
});

// Índice único ux_carga_periodo_vigente: otra carga del mismo mes se confirmó al mismo tiempo
const esCargaDuplicada = (error: unknown) => {
  const e = error as { code?: string; driverError?: { code?: string } };
  return (e?.code ?? e?.driverError?.code) === '23505';
};

@Injectable()
export class CargaEpPostgresqlRepository implements CargaEpRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async listarVigentes(): Promise<CargaEp[]> {
    const filas: FilaCarga[] = await this.dataSource.query(`${SELECT_CARGA} WHERE c.vigente ORDER BY c.periodo DESC`);
    return filas.map(aCarga);
  }

  async buscarVigente(periodo: string): Promise<CargaEp | null> {
    const [fila]: FilaCarga[] = await this.dataSource.query(`${SELECT_CARGA} WHERE c.vigente AND c.periodo = $1::date`, [`${periodo}-01`]);
    return fila ? aCarga(fila) : null;
  }

  async equiposConocidos(codigos: string[]): Promise<string[]> {
    const filas: { nombre: string }[] = await this.dataSource.query(`SELECT nombre FROM maquina WHERE UPPER(nombre) = ANY($1::text[])`, [
      codigos.map((c) => c.toUpperCase()),
    ]);
    return filas.map((f) => f.nombre);
  }

  // Misma regla que la view reportes.v_horas_excel: equivalencia_area o, si dice "Area NN", el área con ese número
  async actividadesSinArea(textos: string[]): Promise<string[]> {
    const filas: { texto: string }[] = await this.dataSource.query(
      `
      SELECT t AS texto
      FROM unnest($1::text[]) AS t
      WHERE NOT EXISTS (
              SELECT 1 FROM reportes.equivalencia_area e WHERE e.texto = LOWER(TRIM(t)) AND e.id_area IS NOT NULL)
        AND NOT EXISTS (
              SELECT 1 FROM area ar
              WHERE COALESCE(NULLIF(ar.codigo, ''), SUBSTRING(ar.nombre FROM '(\\d+)')) = SUBSTRING(t FROM '^\\s*[ÁáAa]rea\\s+(\\d+)'))
      `,
      [textos],
    );
    return filas.map((f) => f.texto);
  }

  async reemplazar(nueva: NuevaCargaEp): Promise<CargaEp | null> {
    let idCarga: number;
    try {
      idCarga = await this.dataSource.transaction(async (manager) => {
        await manager.query(`UPDATE reportes.carga SET vigente = FALSE WHERE periodo = $1::date AND vigente`, [`${nueva.periodo}-01`]);
        const [{ id_carga }]: { id_carga: number }[] = await manager.query(
          `INSERT INTO reportes.carga (periodo, fecha_desde, fecha_hasta, archivo, hash_sha256, filas, subido_por)
           VALUES ($1::date, $2::date, $3::date, $4, $5, $6, $7)
           RETURNING id_carga`,
          [`${nueva.periodo}-01`, nueva.fechaDesde, nueva.fechaHasta, nueva.archivo, nueva.hashSha256, nueva.registros.length, nueva.idUsuario],
        );

        // Todas las filas en una sola consulta: un arreglo por columna
        const r = nueva.registros;
        await manager.query(
          `INSERT INTO reportes.carga_registro
             (id_carga, fila, equipo, categoria, codigo_report, fecha, hora_inicio, horometro_inicial, horometro_final, horas, actividad)
           SELECT $1, * FROM unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::date[], $7::time[], $8::numeric[],
                                    $9::numeric[], $10::numeric[], $11::text[])`,
          [
            id_carga,
            r.map((x) => x.fila),
            r.map((x) => x.equipo),
            r.map((x) => x.categoria),
            r.map((x) => x.codigoReport),
            r.map((x) => x.fecha),
            r.map((x) => x.horaInicio),
            r.map((x) => x.horometroInicial),
            r.map((x) => x.horometroFinal),
            r.map((x) => x.horas),
            r.map((x) => x.actividad),
          ],
        );

        // Horas de la app del rango, congeladas: el EP de un mes pasado no cambia si después llegan turnos sin señal.
        // Por jornada, como el Excel: el turno de noche del día anterior al rango ya es parte del EP
        await manager.query(
          `INSERT INTO reportes.carga_horas_app
             (id_carga, id_turno, id_maquina, equipo, categoria, fecha, hora_inicio, horometro_inicial, horometro_final,
              horas, id_area, area, conflicto, jornada)
           SELECT $1, id_turno, id_maquina, equipo, categoria, fecha, hora_inicio, horometro_inicial, horometro_final,
                  horas, id_area, area, conflicto, jornada
           FROM reportes.v_horas_app
           WHERE jornada BETWEEN $2::date AND $3::date`,
          [id_carga, nueva.fechaDesde, nueva.fechaHasta],
        );
        return id_carga;
      });
    } catch (error) {
      if (esCargaDuplicada(error)) return null;
      throw error;
    }

    const [fila]: FilaCarga[] = await this.dataSource.query(`${SELECT_CARGA} WHERE c.id_carga = $1`, [idCarga]);
    return aCarga(fila);
  }
}
