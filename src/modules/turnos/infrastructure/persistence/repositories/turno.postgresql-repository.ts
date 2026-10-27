import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan, LessThanOrEqual, Not, EntityManager } from 'typeorm';
import type { TurnoRepositoryPort } from '../../../domain/repositories/turno.repository.port';
import { DURACION_MAXIMA_TURNO_HORAS, Turno, EstadoTurno } from '../../../domain/entities/turno.entity';
import { UbicacionTurno, UbicacionTurnoRegistro } from '../../../domain/entities/ubicacion-turno';
import { TurnoOrmEntity } from '../orm-entities/turno.orm-entity';
import { TurnoUbicacionOrmEntity } from '../orm-entities/turno-ubicacion.orm-entity';
import { TurnoEstadoOrmEntity } from '../orm-entities/turno-estado.orm-entity';

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
      if (saved.hora_termino) await this.cerrarVigentes(manager, saved.id_turno, saved.hora_termino);
      return this.mapToDomain(saved);
    });
  }

  async cerrar(turno: Turno, admiteCierreAutomatico: boolean, idClienteCierre: string | null = null): Promise<Turno | null> {
    return this.ormRepository.manager.transaction(async (manager) => {
      // La condición va en el mismo UPDATE: un segundo cierre concurrente espera al primero y ya no la cumple
      const sigueAbierto = admiteCierreAutomatico
        ? "(hora_termino IS NULL OR (estado = 'CERRADO_AUTO' AND horometro_final IS NULL))"
        : 'hora_termino IS NULL';
      const resultado = await manager
        .createQueryBuilder()
        .update(TurnoOrmEntity)
        .set({
          hora_termino: turno.fechaFin,
          horometro_final: turno.horometroFinal,
          estado: turno.estadoActual,
          conflicto: turno.conflicto,
          conflicto_detalle: turno.conflictoDetalle,
          cerrado_por: turno.cerradoPor,
          motivo_cierre: turno.motivoCierre,
          ...(idClienteCierre ? { id_cliente_cierre: idClienteCierre } : {}),
        })
        .where('id_turno = :id', { id: turno.id })
        .andWhere(sigueAbierto)
        .execute();
      if (!resultado.affected) return null;
      if (turno.fechaFin) await this.cerrarVigentes(manager, turno.id!, turno.fechaFin);
      return turno;
    });
  }

  // Al cerrar el turno se cierran también su ubicación y su estado operacional vigentes
  private async cerrarVigentes(manager: EntityManager, idTurno: number, fin: Date) {
    await manager.update(TurnoUbicacionOrmEntity, { id_turno: idTurno, fin: IsNull() }, { fin });
    await manager.update(TurnoEstadoOrmEntity, { id_turno: idTurno, fin: IsNull() }, { fin });
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

  async findUbicacionByIdCliente(idCliente: string): Promise<UbicacionTurnoRegistro | null> {
    const ubicacion = await this.ubicacionRepository.findOne({ where: { id_cliente: idCliente } });
    return ubicacion ? this.mapUbicacion(ubicacion) : null;
  }

  async registrarUbicacion(data: {
    idTurno: number;
    idArea: number;
    idZona: number | null;
    inicio: Date;
    fin: Date | null;
    idCliente: string;
  }): Promise<UbicacionTurnoRegistro> {
    return this.ubicacionRepository.manager.transaction(async (manager) => {
      await manager.update(
        TurnoUbicacionOrmEntity,
        { id_turno: data.idTurno, fin: IsNull(), inicio: LessThanOrEqual(data.inicio) },
        { fin: data.inicio },
      );
      const guardada = await manager.save(
        manager.create(TurnoUbicacionOrmEntity, {
          id_turno: data.idTurno,
          id_area: data.idArea,
          id_zona: data.idZona,
          inicio: data.inicio,
          fin: data.fin,
          id_cliente: data.idCliente,
        }),
      );
      return this.mapUbicacion(guardada);
    });
  }

  async findUltimoHorometroFinal(idMaquina: number, antesDe: Date): Promise<number | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id_maquina: idMaquina, horometro_final: Not(IsNull()), hora_inicio: LessThan(antesDe) },
      order: { hora_inicio: 'DESC' },
    });
    return ormEntity ? Number(ormEntity.horometro_final) : null;
  }

  private mapUbicacion(ubicacion: TurnoUbicacionOrmEntity): UbicacionTurnoRegistro {
    return {
      idTurnoUbicacion: ubicacion.id_turno_ubicacion,
      idTurno: ubicacion.id_turno,
      idArea: ubicacion.id_area,
      idZona: ubicacion.id_zona,
      inicio: ubicacion.inicio,
      fin: ubicacion.fin,
      idCliente: ubicacion.id_cliente,
    };
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
      id_cliente: turno.idCliente,
      conflicto: turno.conflicto,
      conflicto_detalle: turno.conflictoDetalle,
      cerrado_por: turno.cerradoPor,
      motivo_cierre: turno.motivoCierre,
    });
    return manager.save(ormEntity);
  }

  async findById(id: number): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id_turno: id } });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async findByIdClienteCierre(idClienteCierre: string): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id_cliente_cierre: idClienteCierre } });
    return ormEntity ? this.mapToDomain(ormEntity) : null;
  }

  async findUltimoRegistro(idTurno: number): Promise<Date | null> {
    // Redondeado hacia arriba al milisegundo: la base guarda microsegundos y JavaScript no, y truncado el término
    // quedaría una fracción antes del inicio de ese estado
    const [fila]: { ultimo: Date | null }[] = await this.ormRepository.query(
      `SELECT CASE WHEN ultimo = date_trunc('milliseconds', ultimo) THEN ultimo
                   ELSE date_trunc('milliseconds', ultimo) + interval '1 millisecond' END AS ultimo
       FROM (SELECT GREATEST(
               (SELECT MAX(inicio) FROM turno_estado WHERE id_turno = $1),
               (SELECT MAX(inicio) FROM turno_ubicacion WHERE id_turno = $1)
             ) AS ultimo) u`,
      [idTurno],
    );
    return fila?.ultimo ?? null;
  }

  async findCierre(idTurno: number): Promise<{ por: string; fecha: Date } | null> {
    const [fila]: { por: string; fecha: Date }[] = await this.ormRepository.query(
      `SELECT CASE
                WHEN t.cerrado_por IS NOT NULL THEN u.nombre
                WHEN t.estado = 'CERRADO_AUTO' THEN 'el sistema (superó las ${DURACION_MAXIMA_TURNO_HORAS} h)'
                ELSE o.nombre || ' ' || o.apellido
              END AS por,
              t.hora_termino AS fecha
       FROM turno t
       JOIN operador o ON o.id_operador = t.id_operador
       LEFT JOIN usuario u ON u.id_usuario = t.cerrado_por
       WHERE t.id_turno = $1 AND t.hora_termino IS NOT NULL`,
      [idTurno],
    );
    return fila ?? null;
  }

  async findByIdCliente(idCliente: string): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id_cliente: idCliente } });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  // Puede haber más de uno abierto si se aceptó un conflicto al sincronizar; se toma el más reciente
  async findActivoByMaquina(idMaquina: number): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id_maquina: idMaquina, hora_termino: IsNull() },
      order: { hora_inicio: 'DESC' },
    });
    if (!ormEntity) return null;
    return this.mapToDomain(ormEntity);
  }

  async findActivoByOperador(idOperador: number): Promise<Turno | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id_operador: idOperador, hora_termino: IsNull() },
      order: { hora_inicio: 'DESC' },
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
      ormEntity.id_cliente,
      ormEntity.conflicto ?? false,
      ormEntity.conflicto_detalle,
      ormEntity.cerrado_por ?? null,
      ormEntity.motivo_cierre ?? null,
    );
  }
}
