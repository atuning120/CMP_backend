import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ReporteRegistro, ReporteRepositoryPort, TipoReporte } from '../../../domain/repositories/reporte.repository.port';
import { ReporteTurnoOrmEntity } from '../orm-entities/reporte-turno.orm-entity';

@Injectable()
export class ReportePostgresqlRepository implements ReporteRepositoryPort {
  constructor(
    @InjectRepository(ReporteTurnoOrmEntity)
    private readonly ormRepo: Repository<ReporteTurnoOrmEntity>,
  ) {}

  async findById(idReporte: number): Promise<ReporteRegistro | null> {
    const reporte = await this.ormRepo.findOne({ where: { id_reporte: idReporte } });
    return reporte ? this.map(reporte) : null;
  }

  async findByIdCliente(idCliente: string): Promise<ReporteRegistro | null> {
    const reporte = await this.ormRepo.findOne({ where: { id_cliente: idCliente } });
    return reporte ? this.map(reporte) : null;
  }

  async create(data: Omit<ReporteRegistro, 'idReporte'>): Promise<ReporteRegistro> {
    const guardado = await this.ormRepo.save(
      this.ormRepo.create({
        id_turno: data.idTurno,
        tipo: data.tipo,
        descripcion: data.descripcion,
        fecha_hora: data.fechaHora,
        estado_sincronizacion: 'SINCRONIZADO',
        id_cliente: data.idCliente,
      }),
    );
    return this.map(guardado);
  }

  private map(reporte: ReporteTurnoOrmEntity): ReporteRegistro {
    return {
      idReporte: reporte.id_reporte,
      idTurno: reporte.id_turno,
      tipo: reporte.tipo as TipoReporte,
      descripcion: reporte.descripcion,
      fechaHora: reporte.fecha_hora,
      idCliente: reporte.id_cliente,
    };
  }
}
