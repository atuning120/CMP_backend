import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { GpsModificadoError, ImeiDuplicadoError, MODELO_APP_MOVIL } from '../../../domain/repositories/gps.repository.port';
import type {
  AsignacionGps,
  CambioAsignacion,
  CambiosGps,
  DispositivoGps,
  GpsRepositoryPort,
  NuevoGps,
} from '../../../domain/repositories/gps.repository.port';

interface FilaGps {
  id_gps: number;
  imei: string;
  modelo: string | null;
  numero_sim: string | null;
  activo: boolean;
  id_maquina: number | null;
  maquina: string | null;
  vigente_desde: Date | null;
  ultima_fecha: Date | null;
  ultima_bateria: string | null;
}

// Los cambios de asignación se hacen de a uno (bloqueo asesor hasta el fin de la transacción): son pocos, y así lo que se
// comprueba del GPS y de la máquina de destino no cambia mientras se guarda
const BLOQUEO_ASIGNACIONES = 'asignacion_gps';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class GpsPostgresqlRepository implements GpsRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async listar(): Promise<DispositivoGps[]> {
    return this.consultar({});
  }

  async buscar(idGps: number): Promise<DispositivoGps | null> {
    const [gps] = await this.consultar({ idGps });
    return gps ?? null;
  }

  async deMaquina(idMaquina: number): Promise<DispositivoGps | null> {
    const [gps] = await this.consultar({ idMaquina });
    return gps ?? null;
  }

  private async consultar(filtro: { idGps?: number; idMaquina?: number }): Promise<DispositivoGps[]> {
    const filas: FilaGps[] = await this.dataSource.query(
      `SELECT d.id_gps, d.imei, d.modelo, d.numero_sim, COALESCE(d.estado, 'ACTIVO') = 'ACTIVO' AS activo,
              m.id_maquina, m.nombre AS maquina, a.vigente_desde,
              u."timestamp" AS ultima_fecha, u.nivel_bateria AS ultima_bateria
       FROM dispositivo_gps d
       LEFT JOIN asignacion_gps a ON a.id_gps = d.id_gps AND a.vigente_hasta IS NULL
       LEFT JOIN maquina m ON m.id_maquina = a.id_maquina
       -- Índice único (id_gps, timestamp)
       LEFT JOIN LATERAL (
         SELECT t."timestamp", t.nivel_bateria
         FROM tracking_history t
         WHERE t.id_gps = d.id_gps
         ORDER BY t."timestamp" DESC
         LIMIT 1
       ) u ON TRUE
       WHERE d.modelo IS DISTINCT FROM $1
         AND ($2::int IS NULL OR d.id_gps = $2)
         AND ($3::int IS NULL OR a.id_maquina = $3)
       ORDER BY m.nombre ASC NULLS LAST, d.imei ASC`,
      [MODELO_APP_MOVIL, filtro.idGps ?? null, filtro.idMaquina ?? null],
    );
    return filas.map((f) => ({
      idGps: f.id_gps,
      imei: f.imei,
      modelo: f.modelo,
      numeroSim: f.numero_sim,
      activo: f.activo,
      maquina: f.id_maquina === null ? null : { idMaquina: f.id_maquina, nombre: f.maquina ?? '' },
      asignadoDesde: f.vigente_desde,
      ultimaPosicion:
        f.ultima_fecha === null
          ? null
          : // NUMERIC llega como string desde pg
            { fechaHora: f.ultima_fecha, bateria: f.ultima_bateria === null ? null : Number(f.ultima_bateria) },
    }));
  }

  async nombreMaquina(idMaquina: number): Promise<string | null> {
    const [fila]: { nombre: string }[] = await this.dataSource.query('SELECT nombre FROM maquina WHERE id_maquina = $1', [idMaquina]);
    return fila?.nombre ?? null;
  }

  async historial(idGps: number): Promise<AsignacionGps[]> {
    const filas: { id_asignacion: number; id_maquina: number; nombre: string; vigente_desde: Date; vigente_hasta: Date | null }[] =
      await this.dataSource.query(
        `SELECT a.id_asignacion, m.id_maquina, m.nombre, a.vigente_desde, a.vigente_hasta
         FROM asignacion_gps a
         JOIN maquina m ON m.id_maquina = a.id_maquina
         WHERE a.id_gps = $1
         ORDER BY a.vigente_desde DESC, a.id_asignacion DESC
         LIMIT 100`,
        [idGps],
      );
    return filas.map((f) => ({
      idAsignacion: f.id_asignacion,
      maquina: { idMaquina: f.id_maquina, nombre: f.nombre },
      desde: f.vigente_desde,
      hasta: f.vigente_hasta,
    }));
  }

  async crear(datos: NuevoGps): Promise<number> {
    try {
      const [fila]: { id_gps: number }[] = await this.dataSource.query(
        `INSERT INTO dispositivo_gps (imei, modelo, numero_sim, estado) VALUES ($1, $2, $3, 'ACTIVO') RETURNING id_gps`,
        [datos.imei, datos.modelo, datos.numeroSim],
      );
      return fila.id_gps;
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ImeiDuplicadoError();
      }
      throw error;
    }
  }

  async editar(idGps: number, cambios: CambiosGps): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.bloquear(manager);
      if (cambios.activo === false && (await this.maquinaDe(manager, idGps)) !== null) throw new GpsModificadoError();
      await manager.query(
        `UPDATE dispositivo_gps
         SET modelo = CASE WHEN $2 THEN $3 ELSE modelo END,
             numero_sim = CASE WHEN $4 THEN $5 ELSE numero_sim END,
             estado = COALESCE($6, estado)
         WHERE id_gps = $1`,
        [
          idGps,
          cambios.modelo !== undefined,
          cambios.modelo ?? null,
          cambios.numeroSim !== undefined,
          cambios.numeroSim ?? null,
          cambios.activo === undefined ? null : cambios.activo ? 'ACTIVO' : 'INACTIVO',
        ],
      );
    });
  }

  async cambiarAsignacion(cambio: CambioAsignacion): Promise<void> {
    const { idGps, idMaquina, idMaquinaActual, idGpsDesplazado, acciones } = cambio;
    await this.dataSource.transaction(async (manager) => {
      await this.bloquear(manager);
      if ((await this.maquinaDe(manager, idGps)) !== idMaquinaActual) throw new GpsModificadoError();
      if (idMaquina !== null) {
        const [gps]: { activo: boolean }[] = await manager.query(
          `SELECT COALESCE(estado, 'ACTIVO') = 'ACTIVO' AS activo FROM dispositivo_gps WHERE id_gps = $1`,
          [idGps],
        );
        const enDestino = await this.gpsRealesEn(manager, idMaquina);
        const desplazadoVigente = enDestino.length === 0 ? idGpsDesplazado === null : enDestino.some((id) => id === idGpsDesplazado);
        if (!gps?.activo || !desplazadoVigente) throw new GpsModificadoError();
      }
      // Hora única y posterior al bloqueo (CURRENT_TIMESTAMP es la del inicio de la transacción): una asignación termina
      // justo donde empieza la otra, sin posiciones en las dos ni en ninguna
      const [{ ahora }]: { ahora: Date }[] = await manager.query('SELECT clock_timestamp() AS ahora');
      await manager.query(
        `UPDATE asignacion_gps a SET vigente_hasta = $1
         FROM dispositivo_gps d
         WHERE d.id_gps = a.id_gps AND a.vigente_hasta IS NULL
           AND (a.id_gps = $2 OR ($3::int IS NOT NULL AND a.id_maquina = $3 AND d.modelo IS DISTINCT FROM $4))`,
        [ahora, idGps, idMaquina, MODELO_APP_MOVIL],
      );
      if (idMaquina !== null) {
        await manager.query('INSERT INTO asignacion_gps (id_gps, id_maquina, vigente_desde) VALUES ($1, $2, $3)', [idGps, idMaquina, ahora]);
      }
      for (const accion of acciones) {
        // EDITAR: la app móvil y el historial ya saben mostrarla
        await manager.query(
          `INSERT INTO bitacora_jefe_turno (accion, id_maquina, id_usuario, motivo, observacion, detalle)
           VALUES ('EDITAR', $1, $2, $3, $4, $5)`,
          [accion.idMaquina, accion.idUsuario, accion.motivo, accion.observacion, JSON.stringify(accion.detalle)],
        );
      }
    });
  }

  private async bloquear(manager: EntityManager) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [BLOQUEO_ASIGNACIONES]);
  }

  private async maquinaDe(manager: EntityManager, idGps: number): Promise<number | null> {
    const [fila]: { id_maquina: number }[] = await manager.query(
      'SELECT id_maquina FROM asignacion_gps WHERE id_gps = $1 AND vigente_hasta IS NULL',
      [idGps],
    );
    return fila?.id_maquina ?? null;
  }

  private async gpsRealesEn(manager: EntityManager, idMaquina: number): Promise<number[]> {
    const filas: { id_gps: number }[] = await manager.query(
      `SELECT a.id_gps FROM asignacion_gps a JOIN dispositivo_gps d ON d.id_gps = a.id_gps
       WHERE a.id_maquina = $1 AND a.vigente_hasta IS NULL AND d.modelo IS DISTINCT FROM $2`,
      [idMaquina, MODELO_APP_MOVIL],
    );
    return filas.map((f) => f.id_gps);
  }
}
