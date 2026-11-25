import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  Regularizacion,
  RegularizacionHorometroRepositoryPort,
  TurnoARegularizar,
} from '../../../domain/repositories/regularizacion-horometro.repository.port';

const MOTIVO = 'Turno cerrado automáticamente sin horómetro final';

interface FilaTurno {
  id_turno: number;
  operador: string;
  horometro_inicial: string; // NUMERIC llega como string desde pg
  horometro_final: string | null;
  horometro_siguiente: string | null;
}

@Injectable()
export class RegularizacionHorometroPostgresqlRepository implements RegularizacionHorometroRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async turnoCerradoAutomaticamente(idTurno: number): Promise<TurnoARegularizar | null> {
    const [fila]: FilaTurno[] = await this.dataSource.query(
      `
      SELECT t.id_turno, o.nombre || ' ' || o.apellido AS operador, t.horometro_inicial, t.horometro_final,
             (SELECT s.horometro_inicial
              FROM turno s
              WHERE s.id_maquina = t.id_maquina AND (s.hora_inicio, s.id_turno) > (t.hora_inicio, t.id_turno)
              ORDER BY s.hora_inicio, s.id_turno
              LIMIT 1) AS horometro_siguiente
      FROM turno t
      JOIN operador o ON o.id_operador = t.id_operador
      WHERE t.id_turno = $1 AND t.estado = 'CERRADO_AUTO'
      `,
      [idTurno],
    );
    if (!fila) return null;
    return {
      idTurno: fila.id_turno,
      operador: fila.operador,
      horometroInicial: Number(fila.horometro_inicial),
      horometroFinal: fila.horometro_final === null ? null : Number(fila.horometro_final),
      horometroSiguiente: fila.horometro_siguiente === null ? null : Number(fila.horometro_siguiente),
    };
  }

  async existeIdCliente(idCliente: string): Promise<boolean> {
    const [fila]: { existe: boolean }[] = await this.dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM bitacora_jefe_turno WHERE id_cliente = $1 AND accion = 'REGULARIZAR') AS existe`,
      [idCliente],
    );
    return fila.existe;
  }

  async regularizar(datos: Regularizacion): Promise<boolean> {
    // Una sola sentencia: todo se aplica o nada. La condición va en el UPDATE para que una segunda regularización
    // simultánea espere a la primera y ya no la cumpla; sin fila actualizada, los INSERT no agregan nada
    const filas: { id_turno: number }[] = await this.dataSource.query(
      `
      WITH actualizado AS (
        UPDATE turno
        SET horometro_final = $2, horometro_regularizado_por = $3
        WHERE id_turno = $1 AND estado = 'CERRADO_AUTO' AND horometro_final IS NULL
        RETURNING id_turno, id_maquina, id_operador, horometro_inicial, horometro_final
      ),
      bitacora AS (
        INSERT INTO bitacora_jefe_turno (accion, id_maquina, id_usuario, motivo, observacion, detalle, id_cliente, fecha)
        SELECT 'REGULARIZAR', a.id_maquina, $3, $4, $5,
               jsonb_build_object(
                 'idTurno', a.id_turno,
                 'operador', o.nombre || ' ' || o.apellido,
                 'horometroInicial', a.horometro_inicial,
                 'horometroFinal', a.horometro_final
               ),
               $6::uuid, COALESCE($7::timestamptz, now())
        FROM actualizado a
        JOIN operador o ON o.id_operador = a.id_operador
      ),
      atencion AS (
        INSERT INTO atencion_alerta (id_alerta, id_turno, id_usuario, comentario, fecha)
        SELECT $8, a.id_turno, $3, $9, COALESCE($7::timestamptz, now())
        FROM actualizado a
      )
      SELECT id_turno FROM actualizado
      `,
      [
        datos.idTurno,
        datos.horometroFinal,
        datos.idUsuario,
        MOTIVO,
        datos.observacion,
        datos.idCliente,
        datos.fecha,
        datos.idAlerta,
        datos.comentarioAtencion,
      ],
    );
    return filas.length > 0;
  }
}
