import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HORAS_AVISO_TURNO_EXTENDIDO } from '../../../domain/repositories/alerta-turno.repository.port';
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
}

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
      WITH alertas AS (
        (
          SELECT 'E-' || id_turno AS id, 'TURNO_EXTENDIDO' AS tipo,
                 date_trunc('milliseconds', hora_inicio + make_interval(hours => $8)) AS fecha, id_turno
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
          SELECT 'A-' || id_turno, 'CIERRE_AUTOMATICO', date_trunc('milliseconds', hora_termino), id_turno
          FROM turno
          WHERE $2
            AND estado = 'CERRADO_AUTO'
            AND hora_termino >= $3::timestamptz
            AND ($4::timestamptz IS NULL OR hora_termino < $4::timestamptz)
            AND ($5::timestamptz IS NULL OR (date_trunc('milliseconds', hora_termino), 'A-' || id_turno) < ($5::timestamptz, $6::text))
          ORDER BY 3 DESC, 1 DESC
          LIMIT $7
        )
      )
      SELECT a.id, a.tipo, a.fecha, t.id_turno, t.estado, t.hora_inicio, t.hora_termino,
             t.horometro_inicial, t.horometro_final,
             o.nombre || ' ' || o.apellido AS operador, m.id_maquina, m.nombre AS maquina,
             ubicacion.area, ubicacion.zona
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
    }));
  }

  async contarExtendidosEnCurso(): Promise<number> {
    const [fila]: { total: string }[] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM turno
       WHERE estado = 'EN_CURSO' AND hora_inicio <= CURRENT_TIMESTAMP - make_interval(hours => $1)`,
      [HORAS_AVISO_TURNO_EXTENDIDO],
    );
    return Number(fila.total);
  }
}
