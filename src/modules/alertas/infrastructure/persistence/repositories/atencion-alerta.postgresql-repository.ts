import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AtencionAlerta } from '../../../domain/repositories/alerta-turno.repository.port';
import type { AtencionAlertaRepositoryPort } from '../../../domain/repositories/atencion-alerta.repository.port';

@Injectable()
export class AtencionAlertaPostgresqlRepository implements AtencionAlertaRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async registrar({ idAlerta, idTurno, idUsuario, comentario }: { idAlerta: string; idTurno: number; idUsuario: number; comentario: string | null }) {
    await this.dataSource.query(
      `INSERT INTO atencion_alerta (id_alerta, id_turno, id_usuario, comentario) VALUES ($1, $2, $3, $4)`,
      [idAlerta, idTurno, idUsuario, comentario],
    );
  }

  async listar(idAlerta: string): Promise<AtencionAlerta[]> {
    const filas: { usuario: string; fecha: Date; comentario: string | null }[] = await this.dataSource.query(
      `
      SELECT u.nombre AS usuario, x.fecha, x.comentario
      FROM atencion_alerta x
      JOIN usuario u ON u.id_usuario = x.id_usuario
      WHERE x.id_alerta = $1
      ORDER BY x.fecha, x.id_atencion
      `,
      [idAlerta],
    );
    return filas.map((f) => ({ usuario: f.usuario, fecha: f.fecha, comentario: f.comentario }));
  }
}
