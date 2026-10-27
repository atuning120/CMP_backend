import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AtencionAlerta } from '../../../domain/repositories/alerta-turno.repository.port';
import type { AtencionAlertaRepositoryPort } from '../../../domain/repositories/atencion-alerta.repository.port';

@Injectable()
export class AtencionAlertaPostgresqlRepository implements AtencionAlertaRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async registrar(datos: {
    idAlerta: string;
    idTurno: number;
    idUsuario: number;
    comentario: string | null;
    idCliente: string | null;
    fecha: Date | null;
  }) {
    // Dos reintentos simultáneos del mismo cliente: el segundo no inserta (id_cliente es único)
    await this.dataSource.query(
      `INSERT INTO atencion_alerta (id_alerta, id_turno, id_usuario, comentario, id_cliente, fecha)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()))
       ON CONFLICT (id_cliente) DO NOTHING`,
      [datos.idAlerta, datos.idTurno, datos.idUsuario, datos.comentario, datos.idCliente, datos.fecha],
    );
  }

  async existeIdCliente(idCliente: string): Promise<boolean> {
    const [fila]: { existe: boolean }[] = await this.dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM atencion_alerta WHERE id_cliente = $1) AS existe`,
      [idCliente],
    );
    return fila.existe;
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
