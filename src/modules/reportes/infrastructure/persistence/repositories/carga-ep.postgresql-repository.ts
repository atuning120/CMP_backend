import { Injectable } from '@nestjs/common';
import { ConexionReportes } from '../conexion-reportes';
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

// Las cargas van en la base de reportes (ConexionReportes, que puede no ser la principal); la flota y los usuarios de
// la sesión, en la principal
@Injectable()
export class CargaEpPostgresqlRepository implements CargaEpRepositoryPort {
  constructor(private readonly conexion: ConexionReportes) {}

  async listarVigentes(): Promise<CargaEp[]> {
    const dataSource = await this.conexion.dataSource();
    const filas: FilaCarga[] = await dataSource.query(`${SELECT_CARGA} WHERE c.vigente ORDER BY c.periodo DESC`);
    return filas.map(aCarga);
  }

  async buscarVigente(periodo: string): Promise<CargaEp | null> {
    const dataSource = await this.conexion.dataSource();
    const [fila]: FilaCarga[] = await dataSource.query(`${SELECT_CARGA} WHERE c.vigente AND c.periodo = $1::date`, [`${periodo}-01`]);
    return fila ? aCarga(fila) : null;
  }

  async equiposConocidos(codigos: string[]): Promise<string[]> {
    const filas: { codigo: string }[] = await this.conexion.principal.query(
      `SELECT DISTINCT c.codigo
       FROM maquina m
       CROSS JOIN LATERAL (VALUES (m.nombre), (m.codigo_ep)) AS c(codigo)
       WHERE UPPER(c.codigo) = ANY($1::text[])`,
      [codigos.map((c) => c.toUpperCase())],
    );
    return filas.map((f) => f.codigo);
  }

  async usuarioDeCarga(idUsuario: number): Promise<number | null> {
    if (!this.conexion.separada) return idUsuario;
    const [usuario]: { email: string }[] = await this.conexion.principal.query(`SELECT email FROM usuario WHERE id_usuario = $1`, [idUsuario]);
    if (!usuario) return null;
    const dataSource = await this.conexion.dataSource();
    const [enReportes]: { id_usuario: number }[] = await dataSource.query(
      `SELECT id_usuario FROM usuario WHERE LOWER(email) = LOWER($1) ORDER BY id_usuario LIMIT 1`,
      [usuario.email],
    );
    return enReportes?.id_usuario ?? null;
  }

  async reemplazar(nueva: NuevaCargaEp): Promise<CargaEp | null> {
    const dataSource = await this.conexion.dataSource();
    let idCarga: number;
    try {
      idCarga = await dataSource.transaction(async (manager) => {
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
             (id_carga, fila, equipo, categoria, codigo_report, fecha, hora_inicio, horometro_inicial, horometro_final, horas, area,
              id_excel)
           SELECT $1, * FROM unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::date[], $7::time[], $8::numeric[],
                                    $9::numeric[], $10::numeric[], $11::text[], $12::int[])`,
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
            r.map((x) => x.area),
            r.map((x) => x.idExcel),
          ],
        );

        const t = nueva.tarifas;
        if (t.length) {
          await manager.query(
            `INSERT INTO reportes.carga_tarifa (id_carga, tipo, fila, item, descripcion, unidad, cantidad, precio_unitario, total)
             SELECT $1, * FROM unnest($2::text[], $3::int[], $4::text[], $5::text[], $6::text[], $7::numeric[], $8::numeric[],
                                      $9::numeric[])`,
            [
              id_carga,
              t.map((x) => x.tipo),
              t.map((x) => x.fila),
              t.map((x) => x.item),
              t.map((x) => x.descripcion),
              t.map((x) => x.unidad),
              t.map((x) => x.cantidad),
              t.map((x) => x.precioUnitario),
              t.map((x) => x.total),
            ],
          );
        }

        return id_carga;
      });
    } catch (error) {
      if (esCargaDuplicada(error)) return null;
      throw error;
    }

    const [fila]: FilaCarga[] = await dataSource.query(`${SELECT_CARGA} WHERE c.id_carga = $1`, [idCarga]);
    return aCarga(fila);
  }
}
