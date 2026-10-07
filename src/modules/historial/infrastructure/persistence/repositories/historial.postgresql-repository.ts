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
    // Los inicios de turno se leen de TURNO (fuente de verdad) en vez de copiarse a la bitácora
    const filas: FilaHistorial[] = await this.dataSource.query(
      `
      SELECT * FROM (
        SELECT 'B-' || b.id_bitacora AS id, b.accion AS tipo, b.fecha, u.nombre AS actor,
               m.id_maquina, m.nombre AS maquina, b.motivo, b.observacion, b.detalle
        FROM bitacora_jefe_turno b
        JOIN usuario u ON u.id_usuario = b.id_usuario
        JOIN maquina m ON m.id_maquina = b.id_maquina
        WHERE $2

        UNION ALL

        SELECT 'T-' || t.id_turno, 'INICIO_TURNO', t.hora_inicio, o.nombre || ' ' || o.apellido,
               m.id_maquina, m.nombre, NULL, NULL,
               jsonb_build_object(
                 'horometroInicial', t.horometro_inicial,
                 'area', ubicacion.area,
                 'zona', ubicacion.zona,
                 'estadoTurno', t.estado
               )
        FROM turno t
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
        WHERE $1
      ) h
      WHERE $3::timestamptz IS NULL OR h.fecha < $3
      ORDER BY h.fecha DESC
      LIMIT $4
      `,
      [filtro.incluirTurnos, filtro.incluirFlota, filtro.antesDe, filtro.limite],
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
