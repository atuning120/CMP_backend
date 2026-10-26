import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  CategoriaEstadoTurno,
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
  // jsonb: las fechas llegan como texto ISO
  ubicaciones: { area: string; zona: string | null; inicio: string }[];
  estados: { nombre: string; categoria: CategoriaEstadoTurno | null; es_productivo: boolean; inicio: string; fin: string | null }[];
}

// Fotos de un reporte (alias r) como arreglo JSON [{ id, fecha }], de la primera a la última. Las que no traen
// id_cliente no se pueden pedir por GET /evidencias/:id/archivo, así que no se listan
const EVIDENCIAS_DEL_REPORTE = `
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', e.id_cliente, 'fecha', e.fecha_hora) ORDER BY e.fecha_hora, e.id_evidencia)
    FROM evidencia e
    WHERE e.id_reporte = r.id_reporte AND e.id_cliente IS NOT NULL
  ), '[]'::jsonb)`;

// Reporte de inicio o cierre (tipo) del turno t: { descripcion, evidencias } o null si el operador no dejó ninguno
const reporteDelTurno = (tipo: 'INICIO' | 'FIN') => `
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object('descripcion', r.descripcion, 'evidencias', ${EVIDENCIAS_DEL_REPORTE}) AS reporte
    FROM reporte_turno r
    WHERE r.id_turno = t.id_turno AND r.tipo = '${tipo}'
    ORDER BY r.fecha_hora DESC, r.id_reporte DESC
    LIMIT 1
  ) reporte ON TRUE`;

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
                 'motivoCierre', t.motivo_cierre,
                 -- Instrucciones y fotos con que el operador inició el turno
                 'reporte', reporte.reporte
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
        ${reporteDelTurno('INICIO')}
      )

      UNION ALL

      (
        -- Cierre del turno, como un evento aparte de su inicio (en la fecha en que terminó)
        SELECT t.id, 'FIN_TURNO', t.fecha, o.nombre || ' ' || o.apellido,
               m.id_maquina, m.nombre, NULL, NULL,
               jsonb_build_object(
                 'idTurno', t.id_turno,
                 'horometroInicial', t.horometro_inicial,
                 'horometroFinal', t.horometro_final,
                 'horaInicio', t.hora_inicio,
                 'area', ubicacion.area,
                 'zona', ubicacion.zona,
                 'estadoTurno', t.estado,
                 -- Si lo cerró un jefe de turno en nombre del operador (falla de la máquina, mantención)
                 'cerradoPor', jefe.nombre,
                 'motivoCierre', t.motivo_cierre,
                 -- Novedades y fotos con que el operador cerró el turno
                 'reporte', reporte.reporte
               )
        FROM (
          SELECT 'F-' || id_turno AS id, id_turno, date_trunc('milliseconds', hora_termino) AS fecha, hora_inicio,
                 id_operador, id_maquina, horometro_inicial, horometro_final, estado, cerrado_por, motivo_cierre
          FROM turno
          WHERE $1
            AND hora_termino >= $3::timestamptz
            AND ($4::timestamptz IS NULL OR hora_termino < $4::timestamptz)
            AND ($5::timestamptz IS NULL OR (date_trunc('milliseconds', hora_termino), 'F-' || id_turno) < ($5::timestamptz, $6::text))
          ORDER BY fecha DESC, id DESC
          LIMIT $7
        ) t
        JOIN operador o ON o.id_operador = t.id_operador
        JOIN maquina m ON m.id_maquina = t.id_maquina
        LEFT JOIN usuario jefe ON jefe.id_usuario = t.cerrado_por
        -- Ubicación en que terminó el turno
        LEFT JOIN LATERAL (
          SELECT a.nombre AS area, z.nombre AS zona
          FROM turno_ubicacion tu
          JOIN area a ON a.id_area = tu.id_area
          LEFT JOIN zona_trabajo z ON z.id_zona = tu.id_zona
          WHERE tu.id_turno = t.id_turno
          ORDER BY tu.inicio DESC, tu.id_turno_ubicacion DESC
          LIMIT 1
        ) ubicacion ON TRUE
        ${reporteDelTurno('FIN')}
      )

      UNION ALL

      (
        -- Cambios de área/zona durante el turno, registrados por el operador en la app (la ubicación con que
        -- se inició el turno no tiene id_cliente y ya aparece en su inicio)
        SELECT u.id, 'CAMBIO_UBICACION', u.fecha, o.nombre || ' ' || o.apellido,
               m.id_maquina, m.nombre, NULL, NULL,
               jsonb_build_object(
                 'idTurno', u.id_turno,
                 'area', a.nombre,
                 'zona', z.nombre,
                 'areaAnterior', anterior.area,
                 'zonaAnterior', anterior.zona
               )
        FROM (
          SELECT 'U-' || id_turno_ubicacion AS id, id_turno_ubicacion, id_turno, id_area, id_zona, inicio,
                 date_trunc('milliseconds', inicio) AS fecha
          FROM turno_ubicacion
          WHERE $1
            AND id_cliente IS NOT NULL
            AND inicio >= $3::timestamptz
            AND ($4::timestamptz IS NULL OR inicio < $4::timestamptz)
            AND ($5::timestamptz IS NULL OR (date_trunc('milliseconds', inicio), 'U-' || id_turno_ubicacion) < ($5::timestamptz, $6::text))
          ORDER BY fecha DESC, id DESC
          LIMIT $7
        ) u
        JOIN turno t ON t.id_turno = u.id_turno
        JOIN operador o ON o.id_operador = t.id_operador
        JOIN maquina m ON m.id_maquina = t.id_maquina
        JOIN area a ON a.id_area = u.id_area
        LEFT JOIN zona_trabajo z ON z.id_zona = u.id_zona
        -- De dónde venía: la ubicación anterior del mismo turno
        LEFT JOIN LATERAL (
          SELECT ap.nombre AS area, zp.nombre AS zona
          FROM turno_ubicacion p
          JOIN area ap ON ap.id_area = p.id_area
          LEFT JOIN zona_trabajo zp ON zp.id_zona = p.id_zona
          WHERE p.id_turno = u.id_turno AND (p.inicio, p.id_turno_ubicacion) < (u.inicio, u.id_turno_ubicacion)
          ORDER BY p.inicio DESC, p.id_turno_ubicacion DESC
          LIMIT 1
        ) anterior ON TRUE
      )

      UNION ALL

      (
        -- Novedades que el operador reportó durante el turno (p. ej. la foto de una falla), con sus fotos
        SELECT r.id, 'NOVEDAD', r.fecha, o.nombre || ' ' || o.apellido,
               m.id_maquina, m.nombre, NULL, r.descripcion,
               jsonb_build_object('idTurno', r.id_turno, 'evidencias', ${EVIDENCIAS_DEL_REPORTE})
        FROM (
          SELECT 'R-' || id_reporte AS id, id_reporte, id_turno, descripcion, date_trunc('milliseconds', fecha_hora) AS fecha
          FROM reporte_turno
          WHERE $1
            AND tipo = 'NOVEDAD'
            AND fecha_hora >= $3::timestamptz
            AND ($4::timestamptz IS NULL OR fecha_hora < $4::timestamptz)
            AND ($5::timestamptz IS NULL OR (date_trunc('milliseconds', fecha_hora), 'R-' || id_reporte) < ($5::timestamptz, $6::text))
          ORDER BY fecha DESC, id DESC
          LIMIT $7
        ) r
        JOIN turno t ON t.id_turno = r.id_turno
        JOIN operador o ON o.id_operador = t.id_operador
        JOIN maquina m ON m.id_maquina = t.id_maquina
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
             COALESCE(ubicacion.lista, '[]'::jsonb) AS ubicaciones,
             COALESCE(estado.lista, '[]'::jsonb) AS estados
      FROM turno t
      JOIN operador o ON o.id_operador = t.id_operador
      JOIN maquina m ON m.id_maquina = t.id_maquina
      LEFT JOIN usuario jefe ON jefe.id_usuario = t.cerrado_por
      -- Áreas y zonas por las que pasó el turno, en orden
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('area', a.nombre, 'zona', z.nombre, 'inicio', tu.inicio) ORDER BY tu.inicio) AS lista
        FROM turno_ubicacion tu
        JOIN area a ON a.id_area = tu.id_area
        LEFT JOIN zona_trabajo z ON z.id_zona = tu.id_zona
        WHERE tu.id_turno = t.id_turno
      ) ubicacion ON TRUE
      -- Estados operacionales que registró el operador (producción, demoras, fallas), en orden
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
                 'nombre', eo.nombre, 'categoria', eo.categoria, 'es_productivo', eo.es_productivo,
                 'inicio', te.inicio, 'fin', te.fin
               ) ORDER BY te.inicio) AS lista
        FROM turno_estado te
        JOIN estado_operacional eo ON eo.id_estado = te.id_estado
        WHERE te.id_turno = t.id_turno
      ) estado ON TRUE
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
      ubicaciones: fila.ubicaciones.map((u) => ({ area: u.area, zona: u.zona, inicio: new Date(u.inicio) })),
      estados: fila.estados.map((e) => ({
        nombre: e.nombre,
        categoria: e.categoria,
        esProductivo: e.es_productivo,
        inicio: new Date(e.inicio),
        fin: e.fin === null ? null : new Date(e.fin),
      })),
      conflicto: fila.conflicto ? (fila.conflicto_detalle ?? 'Choca con otro turno') : null,
      cerradoPor: fila.cerrado_por,
      motivoCierre: fila.motivo_cierre,
    }));
  }
}
