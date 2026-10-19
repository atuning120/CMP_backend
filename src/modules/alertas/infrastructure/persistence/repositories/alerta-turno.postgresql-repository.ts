import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HORAS_AVISO_TURNO_EXTENDIDO, HORAS_DESCANSO_ENTRE_JORNADAS } from '../../../domain/repositories/alerta-turno.repository.port';
import type { AlertaTurno, AlertaTurnoRepositoryPort, FiltroAlertas } from '../../../domain/repositories/alerta-turno.repository.port';

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
}

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
          ORDER BY fecha DESC, id DESC
          LIMIT $7
        )
      )
      SELECT a.id, a.tipo, a.fecha, t.id_turno, t.estado, t.hora_inicio, t.hora_termino,
             t.horometro_inicial, t.horometro_final,
             o.nombre || ' ' || o.apellido AS operador, m.id_maquina, m.nombre AS maquina,
             ubicacion.area, ubicacion.zona,
             a.inicio_jornada, a.turnos_jornada::int AS turnos_jornada, a.segundos_jornada
      FROM alertas a
      JOIN turno t ON t.id_turno = a.id_turno
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
    }));
  }

  // Un operador cuenta una vez, ya sea porque su turno pasó las horas de aviso o porque las pasó sumando su jornada
  async contarExtendidosEnCurso(): Promise<number> {
    const [fila]: { total: string }[] = await this.dataSource.query(
      `
      WITH ${JORNADAS('CURRENT_TIMESTAMP', 'NULL::timestamptz', '$2')}
      SELECT COUNT(DISTINCT id_operador) AS total
      FROM jornadas
      WHERE estado = 'EN_CURSO' AND antes + (fin - hora_inicio) >= make_interval(hours => $1)
      `,
      [HORAS_AVISO_TURNO_EXTENDIDO, HORAS_DESCANSO_ENTRE_JORNADAS],
    );
    return Number(fila.total);
  }
}
