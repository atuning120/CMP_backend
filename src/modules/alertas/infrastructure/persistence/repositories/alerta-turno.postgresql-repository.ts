import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HORAS_AVISO_TURNO_EXTENDIDO, HORAS_DESCANSO_ENTRE_JORNADAS } from '../../../domain/repositories/alerta-turno.repository.port';
import type {
  AlertaTurno,
  AlertaTurnoRepositoryPort,
  FiltroAlertas,
  TipoAlertaTurno,
} from '../../../domain/repositories/alerta-turno.repository.port';

interface FilaAlerta {
  id: string;
  tipo: AlertaTurno['tipo'];
  fecha: Date;
  id_turno: number;
  estado: string;
  hora_inicio: Date;
  hora_termino: Date | null;
  horometro_inicial: string | null;
  horometro_final: string | null;
  operador: string;
  id_maquina: number;
  maquina: string;
  area: string | null;
  zona: string | null;
  inicio_jornada: Date | null;
  turnos_jornada: number | null;
  segundos_jornada: number | null;
  estado_detencion: string | null;
  inicio_detencion: Date | null;
  fin_detencion: Date | null;
  // jsonb: las fechas llegan como texto ISO
  atenciones: { usuario: string; fecha: string; comentario: string | null }[];
}

// Filtro por atención ($10) sobre el id de la alerta: 'TODAS' no filtra; si no, se compara si tiene alguna atención.
// El id debe ir calificado con su tabla: ATENCION_ALERTA también tiene id_turno y lo tomaría el subquery
const POR_ATENCION = (idAlerta: string) =>
  `($10::text = 'TODAS' OR EXISTS (SELECT 1 FROM atencion_alerta x WHERE x.id_alerta = ${idAlerta}) = ($10::text = 'ATENDIDAS'))`;

/**
 * Jornadas de los operadores: sus turnos encadenados mientras el descanso entre uno y otro sea menor a $9 horas.
 * Por cada turno: en qué jornada va (n), su lugar en ella (orden), cuánto trabajó antes en la jornada (antes) y cuándo
 * empezó. Un turno en curso cuenta hasta ahora. Se miran solo los turnos desde $desde - 72 h (una jornada no dura más).
 * Los parámetros $desde, $hasta y $9 se pasan como texto SQL para reutilizar el bloque en las dos consultas
 */
const JORNADAS = (desde: string, hasta: string, descanso: string) => `
  turnos_recientes AS (
    SELECT id_turno, id_operador, hora_inicio, COALESCE(hora_termino, CURRENT_TIMESTAMP) AS fin, estado
    FROM turno
    WHERE hora_inicio >= ${desde} - interval '72 hours'
      AND (${hasta} IS NULL OR hora_inicio < ${hasta})
  ),
  encadenados AS (
    SELECT *, LAG(fin) OVER (PARTITION BY id_operador ORDER BY hora_inicio, id_turno) AS fin_anterior
    FROM turnos_recientes
  ),
  numerados AS (
    SELECT *,
           SUM(CASE WHEN fin_anterior IS NULL OR hora_inicio - fin_anterior >= make_interval(hours => ${descanso}) THEN 1 ELSE 0 END)
             OVER (PARTITION BY id_operador ORDER BY hora_inicio, id_turno) AS n
    FROM encadenados
  ),
  jornadas AS (
    SELECT *,
           COALESCE(SUM(fin - hora_inicio) OVER (
             PARTITION BY id_operador, n ORDER BY hora_inicio, id_turno ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ), interval '0') AS antes,
           ROW_NUMBER() OVER (PARTITION BY id_operador, n ORDER BY hora_inicio, id_turno) AS orden,
           MIN(hora_inicio) OVER (PARTITION BY id_operador, n) AS inicio_jornada
    FROM numerados
  )`;

// NUMERIC llega como string desde pg
const numero = (valor: string | null) => (valor === null ? null : Number(valor));

@Injectable()
export class AlertaTurnoPostgresqlRepository implements AlertaTurnoRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async listar(filtro: FiltroAlertas): Promise<AlertaTurno[]> {
    // Igual que el historial: cada rama filtra por rango y corta en el límite antes de unirse, y la fecha
    // se trunca a milisegundos para que el cursor que vuelve desde JavaScript compare exacto.
    // El rango del turno extendido se aplica sobre hora_inicio (desplazado 10 h) para usar su índice
    const filas: FilaAlerta[] = await this.dataSource.query(
      `
      WITH ${JORNADAS('$3::timestamptz', '$4::timestamptz', '$9')},
      alertas AS (
        (
          SELECT 'E-' || id_turno AS id, 'TURNO_EXTENDIDO' AS tipo,
                 date_trunc('milliseconds', hora_inicio + make_interval(hours => $8)) AS fecha, id_turno,
                 NULL::timestamptz AS inicio_jornada, NULL::bigint AS turnos_jornada, NULL::float8 AS segundos_jornada
          FROM turno
          WHERE $1
            AND COALESCE(hora_termino, CURRENT_TIMESTAMP) >= hora_inicio + make_interval(hours => $8)
            AND hora_inicio >= $3::timestamptz - make_interval(hours => $8)
            AND ($4::timestamptz IS NULL OR hora_inicio < $4::timestamptz - make_interval(hours => $8))
            AND ($5::timestamptz IS NULL
                 OR (date_trunc('milliseconds', hora_inicio + make_interval(hours => $8)), 'E-' || id_turno) < ($5::timestamptz, $6::text))
            AND ${POR_ATENCION("'E-' || turno.id_turno")}
          ORDER BY fecha DESC, id DESC
          LIMIT $7
        )

        UNION ALL

        (
          SELECT 'A-' || id_turno, 'CIERRE_AUTOMATICO', date_trunc('milliseconds', hora_termino), id_turno,
                 NULL::timestamptz, NULL::bigint, NULL::float8
          FROM turno
          WHERE $2
            AND estado = 'CERRADO_AUTO'
            AND hora_termino >= $3::timestamptz
            AND ($4::timestamptz IS NULL OR hora_termino < $4::timestamptz)
            AND ($5::timestamptz IS NULL OR (date_trunc('milliseconds', hora_termino), 'A-' || id_turno) < ($5::timestamptz, $6::text))
            AND ${POR_ATENCION("'A-' || turno.id_turno")}
          ORDER BY 3 DESC, 1 DESC
          LIMIT $7
        )

        UNION ALL

        (
          -- El turno en que la jornada cruzó las $8 horas trabajadas; desde el segundo turno de la jornada
          SELECT id, tipo, fecha, id_turno, inicio_jornada, orden, segundos_jornada
          FROM (
            SELECT 'J-' || id_turno AS id, 'JORNADA_EXTENDIDA' AS tipo,
                   date_trunc('milliseconds', hora_inicio + (make_interval(hours => $8) - antes)) AS fecha, id_turno,
                   inicio_jornada, orden, EXTRACT(EPOCH FROM antes + (fin - hora_inicio))::float8 AS segundos_jornada
            FROM jornadas
            WHERE $1
              AND orden > 1
              AND antes < make_interval(hours => $8)
              AND antes + (fin - hora_inicio) >= make_interval(hours => $8)
          ) j
          WHERE fecha >= $3::timestamptz
            AND ($4::timestamptz IS NULL OR fecha < $4::timestamptz)
            AND ($5::timestamptz IS NULL OR (fecha, id) < ($5::timestamptz, $6::text))
            AND ${POR_ATENCION('j.id')}
          ORDER BY fecha DESC, id DESC
          LIMIT $7
        )

        UNION ALL

        (
          -- Cada vez que el operador marcó un estado de mantención o falla
          SELECT 'M-' || te.id_turno_estado, 'MANTENCION', date_trunc('milliseconds', te.inicio), te.id_turno,
                 NULL::timestamptz, NULL::bigint, NULL::float8
          FROM turno_estado te
          JOIN estado_operacional eo ON eo.id_estado = te.id_estado
          WHERE $11
            AND eo.categoria = 'MANTENCION'
            AND te.inicio >= $3::timestamptz
            AND ($4::timestamptz IS NULL OR te.inicio < $4::timestamptz)
            AND ($5::timestamptz IS NULL
                 OR (date_trunc('milliseconds', te.inicio), 'M-' || te.id_turno_estado) < ($5::timestamptz, $6::text))
            AND ${POR_ATENCION("'M-' || te.id_turno_estado")}
          ORDER BY 3 DESC, 1 DESC
          LIMIT $7
        )
      )
      SELECT a.id, a.tipo, a.fecha, t.id_turno, t.estado, t.hora_inicio, t.hora_termino,
             t.horometro_inicial, t.horometro_final,
             o.nombre || ' ' || o.apellido AS operador, m.id_maquina, m.nombre AS maquina,
             ubicacion.area, ubicacion.zona,
             a.inicio_jornada, a.turnos_jornada::int AS turnos_jornada, a.segundos_jornada,
             eo.nombre AS estado_detencion, te.inicio AS inicio_detencion, te.fin AS fin_detencion,
             COALESCE(atendida.atenciones, '[]'::jsonb) AS atenciones
      FROM alertas a
      JOIN turno t ON t.id_turno = a.id_turno
      LEFT JOIN turno_estado te ON a.tipo = 'MANTENCION' AND te.id_turno_estado = substring(a.id FROM 3)::int
      LEFT JOIN estado_operacional eo ON eo.id_estado = te.id_estado
      JOIN operador o ON o.id_operador = t.id_operador
      JOIN maquina m ON m.id_maquina = t.id_maquina
      LEFT JOIN LATERAL (
        SELECT ar.nombre AS area, z.nombre AS zona
        FROM turno_ubicacion tu
        JOIN area ar ON ar.id_area = tu.id_area
        LEFT JOIN zona_trabajo z ON z.id_zona = tu.id_zona
        WHERE tu.id_turno = t.id_turno
        ORDER BY tu.inicio DESC
        LIMIT 1
      ) ubicacion ON TRUE
      -- Quién la atendió y las notas posteriores, de la primera a la última
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('usuario', u.nombre, 'fecha', x.fecha, 'comentario', x.comentario)
                         ORDER BY x.fecha, x.id_atencion) AS atenciones
        FROM atencion_alerta x
        JOIN usuario u ON u.id_usuario = x.id_usuario
        WHERE x.id_alerta = a.id
      ) atendida ON TRUE
      ORDER BY a.fecha DESC, a.id DESC
      LIMIT $7
      `,
      [
        filtro.incluirExtendidos,
        filtro.incluirCierresAutomaticos,
        filtro.desde,
        filtro.hasta,
        filtro.despuesDe?.fecha ?? null,
        filtro.despuesDe?.id ?? null,
        filtro.limite,
        HORAS_AVISO_TURNO_EXTENDIDO,
        HORAS_DESCANSO_ENTRE_JORNADAS,
        filtro.estado,
        filtro.incluirMantenciones,
      ],
    );
    return filas.map((fila) => ({
      id: fila.id,
      tipo: fila.tipo,
      fecha: fila.fecha,
      operador: fila.operador,
      maquina: { id: fila.id_maquina, nombre: fila.maquina },
      turno: {
        id: fila.id_turno,
        estado: fila.estado,
        horaInicio: fila.hora_inicio,
        horaTermino: fila.hora_termino,
        horometroInicial: numero(fila.horometro_inicial),
        horometroFinal: numero(fila.horometro_final),
      },
      area: fila.area,
      zona: fila.zona,
      jornada:
        fila.tipo === 'JORNADA_EXTENDIDA' && fila.inicio_jornada
          ? {
              inicio: fila.inicio_jornada,
              turnos: Number(fila.turnos_jornada),
              horas: Math.round((Number(fila.segundos_jornada) / 3600) * 10) / 10,
            }
          : null,
      detencion:
        fila.tipo === 'MANTENCION' && fila.estado_detencion && fila.inicio_detencion
          ? { estado: fila.estado_detencion, inicio: fila.inicio_detencion, fin: fila.fin_detencion }
          : null,
      atenciones: fila.atenciones.map((a) => ({ usuario: a.usuario, fecha: new Date(a.fecha), comentario: a.comentario })),
    }));
  }

  async turnoDeAlerta(tipo: TipoAlertaTurno, id: number): Promise<number | null> {
    const consultas: Record<TipoAlertaTurno, string> = {
      TURNO_EXTENDIDO: `
        SELECT id_turno FROM turno
        WHERE id_turno = $1 AND COALESCE(hora_termino, CURRENT_TIMESTAMP) >= hora_inicio + make_interval(hours => $2)`,
      CIERRE_AUTOMATICO: `SELECT id_turno FROM turno WHERE id_turno = $1 AND estado = 'CERRADO_AUTO'`,
      // La jornada se arma desde el inicio del turno (JORNADAS mira 72 h hacia atrás)
      JORNADA_EXTENDIDA: `
        WITH ${JORNADAS('(SELECT hora_inicio FROM turno WHERE id_turno = $1)', 'NULL::timestamptz', '$3')}
        SELECT id_turno FROM jornadas
        WHERE id_turno = $1 AND orden > 1
          AND antes < make_interval(hours => $2) AND antes + (fin - hora_inicio) >= make_interval(hours => $2)`,
      MANTENCION: `
        SELECT te.id_turno FROM turno_estado te
        JOIN estado_operacional eo ON eo.id_estado = te.id_estado
        WHERE te.id_turno_estado = $1 AND eo.categoria = 'MANTENCION'`,
    };
    const parametros: Record<TipoAlertaTurno, unknown[]> = {
      TURNO_EXTENDIDO: [id, HORAS_AVISO_TURNO_EXTENDIDO],
      CIERRE_AUTOMATICO: [id],
      JORNADA_EXTENDIDA: [id, HORAS_AVISO_TURNO_EXTENDIDO, HORAS_DESCANSO_ENTRE_JORNADAS],
      MANTENCION: [id],
    };
    const [fila]: { id_turno: number }[] = await this.dataSource.query(consultas[tipo], parametros[tipo]);
    return fila ? Number(fila.id_turno) : null;
  }

  // Un operador cuenta una vez, ya sea porque su turno pasó las horas de aviso o porque las pasó sumando su jornada.
  // Una máquina detenida cuenta una vez aunque haya encadenado varios estados de mantención
  async contarActivas(): Promise<number> {
    const [fila]: { total: string }[] = await this.dataSource.query(
      `
      WITH ${JORNADAS('CURRENT_TIMESTAMP', 'NULL::timestamptz', '$2')}
      SELECT
        (SELECT COUNT(DISTINCT id_operador) FROM jornadas
          WHERE estado = 'EN_CURSO' AND antes + (fin - hora_inicio) >= make_interval(hours => $1))
        +
        (SELECT COUNT(DISTINCT t.id_maquina) FROM turno t
          JOIN turno_estado te ON te.id_turno = t.id_turno AND te.fin IS NULL
          JOIN estado_operacional eo ON eo.id_estado = te.id_estado
          WHERE t.estado = 'EN_CURSO' AND eo.categoria = 'MANTENCION') AS total
      `,
      [HORAS_AVISO_TURNO_EXTENDIDO, HORAS_DESCANSO_ENTRE_JORNADAS],
    );
    return Number(fila.total);
  }
}
