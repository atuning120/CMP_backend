import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PosicionDispositivo, PosicionMaquina } from '../../../domain/entities/posicion-gps';
import type { TrackingRepositoryPort } from '../../../domain/repositories/tracking.repository.port';

interface FilaPosicion {
  id_maquina: number;
  fecha_hora: Date;
  latitud: number;
  longitud: number;
  velocidad: string | null;
  rumbo: string | null;
  bateria: string | null;
}

// NUMERIC llega como string desde pg
const numero = (valor: string | null) => (valor === null ? null : Number(valor));

const aPosicion = (f: FilaPosicion): PosicionMaquina => ({
  idMaquina: f.id_maquina,
  fechaHora: f.fecha_hora,
  latitud: f.latitud,
  longitud: f.longitud,
  velocidad: numero(f.velocidad),
  rumbo: numero(f.rumbo),
  bateria: numero(f.bateria),
});

const COLUMNAS_POSICION = `id_maquina, "timestamp" AS fecha_hora, ST_Y(ubicacion) AS latitud, ST_X(ubicacion) AS longitud,
  velocidad, heading AS rumbo, nivel_bateria AS bateria`;

@Injectable()
export class TrackingPostgresqlRepository implements TrackingRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Mientras llegan los LL301, la app móvil hace de GPS con un IMEI virtual por máquina ('9' + id_maquina en 14
   * dígitos). Se registra con la primera posición, así sirve para cualquier máquina sin pasos manuales. Un IMEI que no
   * corresponde a una máquina existente se ignora, y un GPS que ya tuvo asignación se respeta aunque esté cerrada.
   */
  private async registrarGpsVirtuales(imeis: string[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO dispositivo_gps (imei, modelo, estado)
         SELECT '9' || LPAD(m.id_maquina::text, 14, '0'), 'APP_MOVIL', 'ACTIVO'
         FROM maquina m
         WHERE '9' || LPAD(m.id_maquina::text, 14, '0') = ANY($1::text[])
         ON CONFLICT (imei) DO NOTHING`,
        [imeis],
      );
      // Fecha fija en el pasado: una posición guardada sin señal puede llegar con una fecha anterior al registro
      await manager.query(
        `INSERT INTO asignacion_gps (id_gps, id_maquina, vigente_desde)
         SELECT d.id_gps, m.id_maquina, TIMESTAMPTZ '2026-01-01 00:00:00+00'
         FROM maquina m
         JOIN dispositivo_gps d ON d.imei = '9' || LPAD(m.id_maquina::text, 14, '0')
         WHERE d.imei = ANY($1::text[])
           AND d.modelo = 'APP_MOVIL'
           AND NOT EXISTS (SELECT 1 FROM asignacion_gps a WHERE a.id_gps = d.id_gps)`,
        [imeis],
      );
    });
  }

  async guardar(posiciones: PosicionDispositivo[]): Promise<PosicionMaquina[]> {
    await this.registrarGpsVirtuales([...new Set(posiciones.map((p) => p.imei))]);
    const filas = posiciones.map((p) => ({
      imei: p.imei,
      fecha_hora: p.fechaHora.toISOString(),
      latitud: p.latitud,
      longitud: p.longitud,
      velocidad: p.velocidad,
      rumbo: p.rumbo,
      bateria: p.bateria,
      satelites: p.satelites,
      en_tiempo_real: p.enTiempoReal,
      trama_hex: p.tramaHex,
    }));
    // Cada posición va a la máquina a la que estaba asignado el dispositivo en su fecha (puede llegar atrasada).
    // El índice único (id_gps, timestamp) evita duplicar una posición reenviada
    const guardadas: FilaPosicion[] = await this.dataSource.query(
      `WITH entrantes AS (
         SELECT * FROM jsonb_to_recordset($1::jsonb) AS p(
           imei text, fecha_hora timestamptz, latitud float8, longitud float8, velocidad numeric, rumbo numeric,
           bateria numeric, satelites int, en_tiempo_real boolean, trama_hex text)
       ),
       resueltas AS (
         SELECT DISTINCT ON (d.id_gps, e.fecha_hora) e.*, d.id_gps, a.id_maquina
         FROM entrantes e
         JOIN dispositivo_gps d ON d.imei = e.imei
         JOIN asignacion_gps a ON a.id_gps = d.id_gps
          AND a.vigente_desde <= e.fecha_hora
          AND (a.vigente_hasta IS NULL OR a.vigente_hasta > e.fecha_hora)
         ORDER BY d.id_gps, e.fecha_hora, a.vigente_desde DESC
       )
       INSERT INTO tracking_history ("timestamp", id_gps, id_maquina, ubicacion, velocidad, heading, nivel_bateria, payload_crudo)
       SELECT fecha_hora, id_gps, id_maquina, ST_SetSRID(ST_MakePoint(longitud, latitud), 4326), velocidad, rumbo, bateria,
              jsonb_build_object('satelites', satelites, 'enTiempoReal', en_tiempo_real, 'tramaHex', trama_hex)
       FROM resueltas
       ON CONFLICT (id_gps, "timestamp") DO NOTHING
       RETURNING ${COLUMNAS_POSICION}`,
      [JSON.stringify(filas)],
    );
    return guardadas.map(aPosicion);
  }

  async ultimasPorMaquina(desde: Date): Promise<PosicionMaquina[]> {
    const filas: FilaPosicion[] = await this.dataSource.query(
      `SELECT DISTINCT ON (id_maquina) ${COLUMNAS_POSICION}
       FROM tracking_history
       WHERE "timestamp" >= $1 AND ubicacion IS NOT NULL
       ORDER BY id_maquina, "timestamp" DESC`,
      [desde],
    );
    return filas.map(aPosicion);
  }
}
