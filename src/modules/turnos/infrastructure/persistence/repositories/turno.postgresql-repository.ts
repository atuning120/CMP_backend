import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan, EntityManager } from 'typeorm';
import type { TurnoRepositoryPort } from '../../../domain/repositories/turno.repository.port';
import { Turno, EstadoTurno } from '../../../domain/entities/turno.entity';
import { UbicacionTurno } from '../../../domain/entities/ubicacion-turno';
import { TurnoOrmEntity } from '../orm-entities/turno.orm-entity';
import { TurnoUbicacionOrmEntity } from '../orm-entities/turno-ubicacion.orm-entity';

@Injectable()
export class TurnoPostgresqlRepository implements TurnoRepositoryPort {
  constructor(
    @InjectRepository(TurnoOrmEntity)
    private readonly ormRepository: Repository<TurnoOrmEntity>,
    @InjectRepository(TurnoUbicacionOrmEntity)
    private readonly ubicacionRepository: Repository<TurnoUbicacionOrmEntity>,
  ) {}

  async save(turno: Turno): Promise<Turno> {
    return this.ormRepository.manager.transaction(async (manager) => {
      const saved = await this.saveWith(manager, turno);
      if (saved.hora_termino) {
        await manager.update(
          TurnoUbicacionOrmEntity,
          { id_turno: saved.id_turno, fin: IsNull() },
          { fin: saved.hora_termino },
        );
      }
      return this.mapToDomain(saved);
    });
  }

  async iniciar(turno: Turno, ubicacion: UbicacionTurno): Promise<Turno> {
    return this.ormRepository.manager.transaction(async (manager) => {
      const saved = await this.saveWith(manager, turno);
      await manager.save(
        manager.create(TurnoUbicacionOrmEntity, {
          id_turno: saved.id_turno,
          id_area: ubicacion.idArea,
          id_zona: ubicacion.idZona,
          inicio: saved.hora_inicio,
          fin: null,
        }),
      );
      return this.mapToDomain(saved);
    });
  }

  async findUbicacionVigente(idTurno: number): Promise<UbicacionTurno | null> {
    const ubicacion = await this.ubicacionRepository.findOne({
      where: { id_turno: idTurno, fin: IsNull() },
      order: { inicio: 'DESC' },
    });
    return ubicacion ? { idArea: ubicacion.id_area, idZona: ubicacion.id_zona } : null;
  }

  private async saveWith(manager: EntityManager, turno: Turno): Promise<TurnoOrmEntity> {
    const ormEntity = manager.create(TurnoOrmEntity, {
      id_turno: turno.id ?? undefined, // Undefined lets TypeORM rely on DB defaults (nextval)
      id_operador: turno.idOperador,
      id_maquina: turno.idMaquina,
      fecha_turno: turno.fechaInicio, // Asumiendo fecha de inicio como fecha de turno para simplificar
      hora_inicio: turno.fechaInicio,
      hora_termino: turno.fechaFin,
      horometro_inicial: turno.horometroInicial,
      horometro_final: turno.horometroFinal,
      estado: turno.estadoActual,
    });
    return manager.save(ormEntity);
  }

  async findById(id: number): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id_turno: id } });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async findActivoByMaquina(idMaquina: number): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id_maquina: idMaquina, hora_termino: IsNull() },
    });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async findActivoByOperador(idOperador: number): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id_operador: idOperador, hora_termino: IsNull() },
    });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async findUltimoByOperador(idOperador: number): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id_operador: idOperador },
      order: { hora_inicio: 'DESC' },
    });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async findActivosIniciadosAntesDe(fecha: Date): Promise<Turno[]> {
    const ormEntities = await this.ormRepository.find({
      where: { hora_termino: IsNull(), hora_inicio: LessThan(fecha) },
    });
    return ormEntities.map((ormEntity) => this.mapToDomain(ormEntity));
  }

  private mapToDomain(ormEntity: TurnoOrmEntity): Turno {
    return new Turno(
      ormEntity.id_turno,
      ormEntity.id_operador,
      ormEntity.id_maquina,
      ormEntity.hora_inicio,
      ormEntity.hora_termino,
      Number(ormEntity.horometro_inicial),
      ormEntity.horometro_final ? Number(ormEntity.horometro_final) : null,
      (ormEntity.estado as EstadoTurno | null) ?? 'EN_CURSO',
    );
  }
}
