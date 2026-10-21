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

  async guardar(posiciones: PosicionDispositivo[]): Promise<PosicionMaquina[]> {
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
