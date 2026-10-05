import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EvidenciaRegistro, EvidenciaRepositoryPort } from '../../../domain/repositories/evidencia.repository.port';
import { EvidenciaOrmEntity } from '../orm-entities/evidencia.orm-entity';

@Injectable()
export class EvidenciaPostgresqlRepository implements EvidenciaRepositoryPort {
  constructor(
    @InjectRepository(EvidenciaOrmEntity)
    private readonly ormRepo: Repository<EvidenciaOrmEntity>,
  ) {}

  async findByIdCliente(idCliente: string): Promise<EvidenciaRegistro | null> {
    const evidencia = await this.ormRepo.findOne({ where: { id_cliente: idCliente } });
    return evidencia ? this.map(evidencia) : null;
  }

  async create(data: Omit<EvidenciaRegistro, 'idEvidencia'>): Promise<EvidenciaRegistro> {
    const guardado = await this.ormRepo.save(
      this.ormRepo.create({
        id_reporte: data.idReporte,
        url_blob: data.claveArchivo,
        fecha_hora: data.fechaHora,
        estado_sincronizacion: 'SINCRONIZADO',
        id_cliente: data.idCliente,
      }),
    );
    return this.map(guardado);
  }

  private map(evidencia: EvidenciaOrmEntity): EvidenciaRegistro {
    return {
      idEvidencia: evidencia.id_evidencia,
      idReporte: evidencia.id_reporte,
      claveArchivo: evidencia.url_blob,
      fechaHora: evidencia.fecha_hora,
      idCliente: evidencia.id_cliente,
    };
  }
}
