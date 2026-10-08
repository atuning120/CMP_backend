import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EventoHistorial, FiltroHistorial, HistorialRepositoryPort } from '../../../domain/repositories/historial.repository.port';

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
                 'horaTermino', t.hora_termino
               )
        -- Primero se eligen los turnos de la página y recién después se buscan sus datos
        FROM (
          SELECT 'T-' || id_turno AS id, id_turno, date_trunc('milliseconds', hora_inicio) AS fecha,
                 id_operador, id_maquina, horometro_inicial, estado, hora_termino
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
}
