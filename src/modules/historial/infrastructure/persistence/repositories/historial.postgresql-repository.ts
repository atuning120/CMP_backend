import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  EventoHistorial,
  FiltroHistorial,
  FiltroTurnosConciliacion,
  HistorialRepositoryPort,
  TurnoConciliacion,
} from '../../../domain/repositories/historial.repository.port';

interface FilaHistorial {
  id: string;
  tipo: EventoHistorial['tipo'];
  fecha: Date;
  actor: string;
  id_maquina: number;
  maquina: string;
  motivo: string | null;
  observacion: string | null;
  detalle: Record<string, unknown> | null;
}

interface FilaTurno {
  id_turno: number;
  hora_inicio: Date;
  hora_termino: Date | null;
  estado: string;
  horometro_inicial: string; // NUMERIC llega como texto
  horometro_final: string | null;
  conflicto: boolean;
  conflicto_detalle: string | null;
  motivo_cierre: string | null;
  cerrado_por: string | null;
  operador: string;
  equipo: string;
  patente: string | null;
  numero_chasis: string | null;
  tipo_maquina: string | null;
  es_contratista: boolean;
  ubicaciones: { area: string; zona: string | null }[];
}

@Injectable()
export class HistorialPostgresqlRepository implements HistorialRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async listar(filtro: FiltroHistorial): Promise<EventoHistorial[]> {
    // Los inicios de turno se leen de TURNO (fuente de verdad) en vez de copiarse a la bitácora.
    // Cada rama filtra por rango (usa los índices por fecha) y corta en el límite antes de unirse,
    // así la consulta no crece con el tamaño de las tablas. La fecha se trunca a milisegundos para que
    // el cursor que vuelve desde JavaScript (Date) compare exacto contra la database (microsegundos).
    const filas: FilaHistorial[] = await this.dataSource.query(
      `
      (
        SELECT 'B-' || b.id_bitacora AS id, b.accion AS tipo, date_trunc('milliseconds', b.fecha) AS fecha,
               u.nombre AS actor, m.id_maquina, m.nombre AS maquina, b.motivo, b.observacion, b.detalle
        FROM bitacora_jefe_turno b
        JOIN usuario u ON u.id_usuario = b.id_usuario
        JOIN maquina m ON m.id_maquina = b.id_maquina
        WHERE $2
          AND b.fecha >= $3::timestamptz
          AND ($4::timestamptz IS NULL OR b.fecha < $4::timestamptz)
          AND ($5::timestamptz IS NULL OR (date_trunc('milliseconds', b.fecha), 'B-' || b.id_bitacora) < ($5::timestamptz, $6::text))
        ORDER BY fecha DESC, id DESC
        LIMIT $7
      )

      UNION ALL

      (
        SELECT t.id, 'INICIO_TURNO', t.fecha, o.nombre || ' ' || o.apellido,
               m.id_maquina, m.nombre, NULL, NULL,
               jsonb_build_object(
                 'horometroInicial', t.horometro_inicial,
                 'area', ubicacion.area,
                 'zona', ubicacion.zona,
                 'estadoTurno', t.estado,
                 'horaTermino', t.hora_termino,
                 -- Si lo cerró un jefe de turno en nombre del operador (falla de la máquina, mantención)
                 'cerradoPor', jefe.nombre,
                 'motivoCierre', t.motivo_cierre
               )
        -- Primero se eligen los turnos de la página y recién después se buscan sus datos
        FROM (
          SELECT 'T-' || id_turno AS id, id_turno, date_trunc('milliseconds', hora_inicio) AS fecha,
                 id_operador, id_maquina, horometro_inicial, estado, hora_termino, cerrado_por, motivo_cierre
          FROM turno
          WHERE $1
            AND hora_inicio >= $3::timestamptz
            AND ($4::timestamptz IS NULL OR hora_inicio < $4::timestamptz)
            AND ($5::timestamptz IS NULL OR (date_trunc('milliseconds', hora_inicio), 'T-' || id_turno) < ($5::timestamptz, $6::text))
          ORDER BY fecha DESC, id DESC
          LIMIT $7
        ) t
        JOIN operador o ON o.id_operador = t.id_operador
        JOIN maquina m ON m.id_maquina = t.id_maquina
        LEFT JOIN usuario jefe ON jefe.id_usuario = t.cerrado_por
        -- Ubicación con que se inició el turno
        LEFT JOIN LATERAL (
          SELECT a.nombre AS area, z.nombre AS zona
          FROM turno_ubicacion tu
          JOIN area a ON a.id_area = tu.id_area
          LEFT JOIN zona_trabajo z ON z.id_zona = tu.id_zona
          WHERE tu.id_turno = t.id_turno
          ORDER BY tu.inicio ASC
          LIMIT 1
        ) ubicacion ON TRUE
      )

      ORDER BY fecha DESC, id DESC
      LIMIT $7
      `,
      [
        filtro.incluirTurnos,
        filtro.incluirFlota,
        filtro.desde,
        filtro.hasta,
        filtro.despuesDe?.fecha ?? null,
        filtro.despuesDe?.id ?? null,
        filtro.limite,
      ],
    );
    return filas.map((fila) => ({
      id: fila.id,
      tipo: fila.tipo,
      fecha: fila.fecha,
      actor: fila.actor,
      maquina: { id: fila.id_maquina, nombre: fila.maquina },
      motivo: fila.motivo,
      observacion: fila.observacion,
      detalle: fila.detalle,
    }));
  }

  async listarTurnos(filtro: FiltroTurnosConciliacion): Promise<TurnoConciliacion[]> {
    const filas: FilaTurno[] = await this.dataSource.query(
      `
      SELECT t.id_turno, t.hora_inicio, t.hora_termino, t.estado, t.horometro_inicial, t.horometro_final,
             t.conflicto, t.conflicto_detalle, t.motivo_cierre, jefe.nombre AS cerrado_por,
             o.nombre || ' ' || o.apellido AS operador,
             m.nombre AS equipo, m.patente, m.numero_chasis, m.tipo_maquina, m.es_contratista,
             COALESCE(ubicacion.lista, '[]'::jsonb) AS ubicaciones
      FROM turno t
      JOIN operador o ON o.id_operador = t.id_operador
      JOIN maquina m ON m.id_maquina = t.id_maquina
      LEFT JOIN usuario jefe ON jefe.id_usuario = t.cerrado_por
      -- Áreas y zonas por las que pasó el turno, en orden
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('area', a.nombre, 'zona', z.nombre) ORDER BY tu.inicio) AS lista
        FROM turno_ubicacion tu
        JOIN area a ON a.id_area = tu.id_area
        LEFT JOIN zona_trabajo z ON z.id_zona = tu.id_zona
        WHERE tu.id_turno = t.id_turno
      ) ubicacion ON TRUE
      WHERE t.hora_inicio >= $1::timestamptz AND t.hora_inicio < $2::timestamptz
      ORDER BY t.hora_inicio ASC, m.nombre ASC
      LIMIT $3
      `,
      [filtro.desde, filtro.hasta, filtro.limite],
    );
    return filas.map((fila) => ({
      idTurno: fila.id_turno,
      horaInicio: fila.hora_inicio,
      horaTermino: fila.hora_termino,
      estado: fila.estado,
      horometroInicial: Number(fila.horometro_inicial),
      horometroFinal: fila.horometro_final === null ? null : Number(fila.horometro_final),
      equipo: {
        codigo: fila.equipo,
        patente: fila.patente,
        numeroChasis: fila.numero_chasis,
        tipo: fila.tipo_maquina,
        esContratista: fila.es_contratista,
      },
      operador: fila.operador,
      ubicaciones: fila.ubicaciones,
      conflicto: fila.conflicto ? (fila.conflicto_detalle ?? 'Choca con otro turno') : null,
      cerradoPor: fila.cerrado_por,
      motivoCierre: fila.motivo_cierre,
    }));
  }
}
