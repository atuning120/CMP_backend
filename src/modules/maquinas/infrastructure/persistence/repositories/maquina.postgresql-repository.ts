import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type {
  AccionBitacora,
  FichaMaquina,
  MaquinaCatalogo,
  MaquinaFlota,
  MaquinaRepositoryPort,
  MaquinaResumen,
  NuevaMaquina,
  OperadorAsignable,
  RegistroBitacora,
} from '../../../domain/repositories/maquina.repository.port';
import { MaquinaOrmEntity } from '../orm-entities/maquina.orm-entity';

@Injectable()
export class MaquinaPostgresqlRepository implements MaquinaRepositoryPort {
  constructor(
    @InjectRepository(MaquinaOrmEntity)
    private readonly ormRepository: Repository<MaquinaOrmEntity>,
  ) {}

  async findById(idMaquina: number): Promise<MaquinaResumen | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id_maquina: idMaquina } });
    if (!ormEntity) return null;
    return this.mapToResumen(ormEntity);
  }

  async findActivas(): Promise<MaquinaCatalogo[]> {
    const filas: (FilaMaquina & { id_operador: number | null })[] = await this.ormRepository.query(`
      SELECT m.id_maquina, m.nombre, m.marca, m.modelo, m.tipo_maquina, m.estado, ao.id_operador
      FROM maquina m
      LEFT JOIN asignacion_operador ao ON ao.id_maquina = m.id_maquina AND ao.vigente_hasta IS NULL
      WHERE m.estado = 'ACTIVA'
      ORDER BY m.nombre ASC
    `);
    return filas.map((fila) => ({
      idMaquina: fila.id_maquina,
      nombre: fila.nombre,
      marca: fila.marca,
      modelo: fila.modelo,
      tipoMaquina: fila.tipo_maquina,
      estado: fila.estado,
      idOperadorAsignado: fila.id_operador,
    }));
  }

  async findFlota(busqueda: string | null): Promise<MaquinaFlota[]> {
    // Se escapan los comodines de LIKE para buscar el texto literal
    const patron = busqueda ? `%${busqueda.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    return this.consultarFlota(patron, null);
  }

  async findFlotaById(idMaquina: number): Promise<MaquinaFlota | null> {
    const [maquina] = await this.consultarFlota(null, idMaquina);
    return maquina ?? null;
  }

  private async consultarFlota(patron: string | null, idMaquina: number | null): Promise<MaquinaFlota[]> {
    const filas: FilaFlota[] = await this.ormRepository.query(
      `
      SELECT m.id_maquina, m.nombre, m.marca, m.modelo, m.tipo_maquina, m.estado, m.patente,
             m.anio, m.numero_chasis, m.es_contratista,
             oa.id_operador AS id_operador_asignado, oa.nombre || ' ' || oa.apellido AS operador_asignado,
             baja.motivo AS motivo_baja, baja.observacion AS observacion_baja, baja.fecha AS fecha_baja,
             actual.operador, actual.ubicacion,
             COALESCE(ultimo.horometro, m.horometro_inicial) AS horometro
      FROM maquina m
      LEFT JOIN asignacion_operador ao ON ao.id_maquina = m.id_maquina AND ao.vigente_hasta IS NULL
      LEFT JOIN operador oa ON oa.id_operador = ao.id_operador
      -- Por qué está fuera de servicio: la última vez que se deshabilitó
      LEFT JOIN LATERAL (
        SELECT b.motivo, b.observacion, b.fecha
        FROM bitacora_jefe_turno b
        WHERE b.id_maquina = m.id_maquina AND b.accion = 'DESHABILITAR'
        ORDER BY b.fecha DESC
        LIMIT 1
      ) baja ON m.estado = 'BAJA'
      LEFT JOIN LATERAL (
        SELECT o.nombre || ' ' || o.apellido AS operador,
               COALESCE(z.nombre, a.nombre) AS ubicacion
        FROM turno t
        JOIN operador o ON o.id_operador = t.id_operador
        LEFT JOIN turno_ubicacion tu ON tu.id_turno = t.id_turno AND tu.fin IS NULL
        LEFT JOIN area a ON a.id_area = tu.id_area
        LEFT JOIN zona_trabajo z ON z.id_zona = tu.id_zona
        WHERE t.id_maquina = m.id_maquina AND t.estado = 'EN_CURSO'
        ORDER BY t.hora_inicio DESC, tu.inicio DESC
        LIMIT 1
      ) actual ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(t.horometro_final, t.horometro_inicial) AS horometro
        FROM turno t
        WHERE t.id_maquina = m.id_maquina
        ORDER BY t.hora_inicio DESC
        LIMIT 1
      ) ultimo ON TRUE
      WHERE ($1::text IS NULL
         OR m.nombre ILIKE $1 OR m.marca ILIKE $1 OR m.modelo ILIKE $1 OR m.tipo_maquina ILIKE $1
         OR m.patente ILIKE $1)
        AND ($2::int IS NULL OR m.id_maquina = $2)
      ORDER BY m.nombre ASC
      `,
      [patron, idMaquina],
    );
    return filas.map((fila) => ({
      idMaquina: fila.id_maquina,
      nombre: fila.nombre,
      marca: fila.marca,
      modelo: fila.modelo,
      tipoMaquina: fila.tipo_maquina,
      estado: fila.estado,
      patente: fila.patente,
      anio: fila.anio,
      numeroChasis: fila.numero_chasis,
      esContratista: fila.es_contratista,
      operadorAsignado:
        fila.id_operador_asignado === null ? null : { idOperador: fila.id_operador_asignado, nombre: fila.operador_asignado ?? '' },
      fueraDeServicio:
        fila.motivo_baja === null || fila.fecha_baja === null
          ? null
          : { motivo: fila.motivo_baja, observacion: fila.observacion_baja, fecha: fila.fecha_baja },
      operadorActual: fila.operador,
      ubicacionActual: fila.ubicacion,
      // NUMERIC llega como string desde pg
      horometroActual: fila.horometro === null ? null : Number(fila.horometro),
    }));
  }

  async existeNombre(nombre: string, exceptoId?: number): Promise<boolean> {
    return this.existe('UPPER(m.nombre) = UPPER(:valor)', nombre, exceptoId);
  }

  async existePatente(patente: string, exceptoId?: number): Promise<boolean> {
    return this.existe('UPPER(m.patente) = UPPER(:valor)', patente, exceptoId);
  }

  private async existe(condicion: string, valor: string, exceptoId?: number): Promise<boolean> {
    const query = this.ormRepository.createQueryBuilder('m').where(condicion, { valor });
    if (exceptoId !== undefined) query.andWhere('m.id_maquina <> :exceptoId', { exceptoId });
    return query.getExists();
  }

  async tieneTurnoEnCurso(idMaquina: number): Promise<boolean> {
    const [fila]: { existe: boolean }[] = await this.ormRepository.query(
      `SELECT EXISTS (SELECT 1 FROM turno WHERE id_maquina = $1 AND estado = 'EN_CURSO') AS existe`,
      [idMaquina],
    );
    return fila.existe;
  }

  async findOperadoresAsignables(): Promise<OperadorAsignable[]> {
    return this.consultarOperadores(null);
  }

  async findOperadorAsignable(idOperador: number): Promise<OperadorAsignable | null> {
    const [operador] = await this.consultarOperadores(idOperador);
    return operador ?? null;
  }

  // Solo operadores que pueden iniciar turno en la app (usuario OPERADOR activo), con su máquina vigente
  private async consultarOperadores(idOperador: number | null): Promise<OperadorAsignable[]> {
    const filas: { id_operador: number; nombre: string; rut: string; id_maquina: number | null; maquina: string | null }[] =
      await this.ormRepository.query(
        `
        SELECT o.id_operador, o.nombre || ' ' || o.apellido AS nombre, o.rut, m.id_maquina, m.nombre AS maquina
        FROM operador o
        LEFT JOIN asignacion_operador ao ON ao.id_operador = o.id_operador AND ao.vigente_hasta IS NULL
        LEFT JOIN maquina m ON m.id_maquina = ao.id_maquina
        WHERE EXISTS (SELECT 1 FROM usuario u WHERE u.id_operador = o.id_operador AND u.rol = 'OPERADOR' AND u.activo)
          AND ($1::int IS NULL OR o.id_operador = $1)
        ORDER BY o.nombre ASC, o.apellido ASC
        `,
        [idOperador],
      );
    return filas.map((fila) => ({
      idOperador: fila.id_operador,
      nombre: fila.nombre,
      rut: fila.rut,
      maquinaAsignada: fila.id_maquina === null ? null : { idMaquina: fila.id_maquina, nombre: fila.maquina ?? '' },
    }));
  }

  // Cierra la asignación vigente de la máquina y la del operador (si estaba en otra) y abre la nueva
  private async asignarOperador(manager: EntityManager, idMaquina: number, idOperador: number | null) {
    await manager.query(
      `UPDATE asignacion_operador SET vigente_hasta = CURRENT_TIMESTAMP
       WHERE vigente_hasta IS NULL AND (id_maquina = $1 OR ($2::int IS NOT NULL AND id_operador = $2))`,
      [idMaquina, idOperador],
    );
    if (idOperador !== null) {
      await manager.query(`INSERT INTO asignacion_operador (id_maquina, id_operador) VALUES ($1, $2)`, [idMaquina, idOperador]);
    }
  }

  private async registrarAcciones(manager: EntityManager, idMaquina: number, acciones: AccionBitacora[]) {
    for (const accion of acciones) {
      await manager.query(
        `INSERT INTO bitacora_jefe_turno (accion, id_maquina, id_usuario, motivo, observacion, detalle)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          accion.accion,
          accion.idMaquina ?? idMaquina,
          accion.idUsuario,
          accion.motivo,
          accion.observacion,
          accion.detalle === null ? null : JSON.stringify(accion.detalle),
        ],
      );
    }
  }

  async actualizar(idMaquina: number, cambios: Partial<FichaMaquina>, acciones: AccionBitacora[]): Promise<void> {
    const columnas: Partial<MaquinaOrmEntity> = {
      nombre: cambios.nombre,
      marca: cambios.marca,
      modelo: cambios.modelo,
      anio: cambios.anio,
      tipo_maquina: cambios.tipoMaquina,
      patente: cambios.patente,
      numero_chasis: cambios.numeroChasis,
      es_contratista: cambios.esContratista,
      estado: cambios.estado,
    };
    // Solo las columnas que cambian (undefined = no se toca; null sí se guarda)
    const set = Object.fromEntries(Object.entries(columnas).filter(([, valor]) => valor !== undefined));
    await this.ormRepository.manager.transaction(async (manager) => {
      if (Object.keys(set).length > 0) await manager.getRepository(MaquinaOrmEntity).update({ id_maquina: idMaquina }, set);
      if (cambios.idOperador !== undefined) await this.asignarOperador(manager, idMaquina, cambios.idOperador);
      await this.registrarAcciones(manager, idMaquina, acciones);
    });
  }

  async create(datos: NuevaMaquina, registro: RegistroBitacora, acciones: AccionBitacora[] = []): Promise<MaquinaFlota> {
    const ormEntity = await this.ormRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(MaquinaOrmEntity);
      const creada = await repo.save(
        repo.create({
          nombre: datos.nombre,
          marca: datos.marca,
          modelo: datos.modelo,
          anio: datos.anio,
          tipo_maquina: datos.tipoMaquina,
          estado: 'ACTIVA',
          patente: datos.patente,
          numero_chasis: datos.numeroChasis,
          horometro_inicial: String(datos.horometroInicial),
          es_contratista: datos.esContratista,
        }),
      );
      await manager.query(
        `INSERT INTO bitacora_jefe_turno (accion, id_maquina, id_usuario, motivo, observacion, detalle)
         VALUES ('INCORPORAR', $1, $2, $3, $4, $5)`,
        [creada.id_maquina, registro.idUsuario, registro.motivo, registro.observacion, JSON.stringify(datos)],
      );
      if (datos.idOperador !== null) await this.asignarOperador(manager, creada.id_maquina, datos.idOperador);
      await this.registrarAcciones(manager, creada.id_maquina, acciones);
      return creada;
    });
    // Se lee como en la flota para traer al operador asignado; recién incorporada, aún no tiene turnos
    const maquina = await this.findFlotaById(ormEntity.id_maquina);
    if (!maquina) throw new Error(`La máquina ${ormEntity.id_maquina} no se encontró después de crearla`);
    return maquina;
  }

  async findTipos(): Promise<string[]> {
    return this.valoresEnUso('tipo_maquina');
  }

  async findMarcas(): Promise<string[]> {
    return this.valoresEnUso('marca');
  }

  // Valores distintos de una columna en la flota y en el catálogo de modelos activos.
  // Variantes que solo difieren en mayúsculas o espacios se muestran una sola vez.
  private async valoresEnUso(columna: 'tipo_maquina' | 'marca'): Promise<string[]> {
    const filas: { valor: string }[] = await this.ormRepository.query(`
      SELECT MIN(valor) AS valor
      FROM (
        SELECT TRIM(${columna}) AS valor FROM maquina
        UNION ALL
        SELECT TRIM(${columna}) FROM modelo_maquina WHERE activo
      ) t
      WHERE valor IS NOT NULL AND valor <> ''
      GROUP BY UPPER(valor)
      ORDER BY MIN(valor)
    `);
    return filas.map((fila) => fila.valor);
  }

  private mapToResumen(ormEntity: MaquinaOrmEntity): MaquinaResumen {
    return {
      idMaquina: ormEntity.id_maquina,
      nombre: ormEntity.nombre,
      marca: ormEntity.marca,
      modelo: ormEntity.modelo,
      tipoMaquina: ormEntity.tipo_maquina,
      estado: ormEntity.estado,
    };
  }
}

interface FilaFlota {
  id_maquina: number;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  tipo_maquina: string | null;
  estado: string | null;
  patente: string | null;
  anio: number | null;
  numero_chasis: string | null;
  es_contratista: boolean;
  id_operador_asignado: number | null;
  operador_asignado: string | null;
  motivo_baja: string | null;
  observacion_baja: string | null;
  fecha_baja: Date | null;
  operador: string | null;
  ubicacion: string | null;
  horometro: string | null;
}

interface FilaMaquina {
  id_maquina: number;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  tipo_maquina: string | null;
  estado: string | null;
}
