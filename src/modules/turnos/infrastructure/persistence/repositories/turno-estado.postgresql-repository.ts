import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import type {
  CategoriaEstado,
  EstadoOperacionalResumen,
  TurnoEstadoRegistro,
  TurnoEstadoRepositoryPort,
} from '../../../domain/repositories/turno-estado.repository.port';
import { EstadoOperacionalOrmEntity } from '../orm-entities/estado-operacional.orm-entity';
import { TurnoEstadoOrmEntity } from '../orm-entities/turno-estado.orm-entity';
import { EVENTO_TURNOS_CAMBIARON } from '../../../../../shared/application/eventos-turnos';

@Injectable()
export class TurnoEstadoPostgresqlRepository implements TurnoEstadoRepositoryPort {
  constructor(
    @InjectRepository(EstadoOperacionalOrmEntity)
    private readonly catalogoRepo: Repository<EstadoOperacionalOrmEntity>,
    @InjectRepository(TurnoEstadoOrmEntity)
    private readonly turnoEstadoRepo: Repository<TurnoEstadoOrmEntity>,
    private readonly eventos: EventEmitter2,
  ) {}

  async findCatalogoActivo(): Promise<EstadoOperacionalResumen[]> {
    const estados = await this.catalogoRepo.find({ where: { activo: true }, order: { id_estado: 'ASC' } });
    return estados.map((estado) => this.mapEstado(estado));
  }

  async findEstadoById(idEstado: number): Promise<EstadoOperacionalResumen | null> {
    const estado = await this.catalogoRepo.findOne({ where: { id_estado: idEstado } });
    return estado ? this.mapEstado(estado) : null;
  }

  async findByIdCliente(idCliente: string): Promise<TurnoEstadoRegistro | null> {
    const registro = await this.turnoEstadoRepo.findOne({ where: { id_cliente: idCliente } });
    return registro ? this.mapRegistro(registro) : null;
  }

  async findHistorial(idTurno: number): Promise<TurnoEstadoRegistro[]> {
    const registros = await this.turnoEstadoRepo.find({ where: { id_turno: idTurno }, order: { inicio: 'ASC' } });
    return registros.map((registro) => this.mapRegistro(registro));
  }

  async registrarCambio(data: {
    idTurno: number;
    idEstado: number;
    inicio: Date;
    fin: Date | null;
    comentario: string | null;
    idCliente: string;
  }): Promise<TurnoEstadoRegistro> {
    const registro = await this.turnoEstadoRepo.manager.transaction(async (manager) => {
      await manager.update(
        TurnoEstadoOrmEntity,
        { id_turno: data.idTurno, fin: IsNull(), inicio: LessThanOrEqual(data.inicio) },
        { fin: data.inicio },
      );
      const guardado = await manager.save(
        manager.create(TurnoEstadoOrmEntity, {
          id_turno: data.idTurno,
          id_estado: data.idEstado,
          inicio: data.inicio,
          fin: data.fin,
          comentario: data.comentario,
          id_cliente: data.idCliente,
        }),
      );
      return this.mapRegistro(guardado);
    });
    // Después del commit: una mantención o falla se avisa al instante como alerta (la revisión debe ver el cambio)
    this.eventos.emit(EVENTO_TURNOS_CAMBIARON);
    return registro;
  }

  private mapEstado(estado: EstadoOperacionalOrmEntity): EstadoOperacionalResumen {
    return {
      idEstado: estado.id_estado,
      nombre: estado.nombre,
      categoria: estado.categoria as CategoriaEstado | null,
      esProductivo: estado.es_productivo,
      activo: estado.activo,
      descripcion: estado.descripcion,
    };
  }

  private mapRegistro(registro: TurnoEstadoOrmEntity): TurnoEstadoRegistro {
    return {
      idTurnoEstado: registro.id_turno_estado,
      idTurno: registro.id_turno,
      idEstado: registro.id_estado,
      inicio: registro.inicio,
      fin: registro.fin,
      comentario: registro.comentario,
      idCliente: registro.id_cliente,
    };
  }
}
