import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { esEstadoMaquina, ESTADOS_CON_REGRESO, MaquinaModificadaError } from '../../../domain/repositories/maquina.repository.port';
import type {
  AccionBitacora,
  CambiosMaquina,
  DevolucionMaquina,
  MaquinaCatalogo,
  MaquinaFlota,
  MaquinaRepositoryPort,
  MaquinaResumen,
  NuevaMaquina,
  OperadorAsignable,
  ReemplazoMaquina,
  RegistroBitacora,
  VersionEsperada,
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
    const filas: (FilaMaquina & { id_operador: number | null; horometro_final: string | null })[] = await this.ormRepository.query(`
      SELECT m.id_maquina, m.nombre, m.marca, m.modelo, m.tipo_maquina, m.estado, ao.id_operador, ultimo.horometro_final
      FROM maquina m
      LEFT JOIN asignacion_operador ao ON ao.id_maquina = m.id_maquina AND ao.vigente_hasta IS NULL
      LEFT JOIN LATERAL (
        SELECT t.horometro_final
        FROM turno t
        WHERE t.id_maquina = m.id_maquina AND t.horometro_final IS NOT NULL
        ORDER BY t.hora_inicio DESC
        LIMIT 1
      ) ultimo ON TRUE
      WHERE m.estado IN ('ACTIVA', 'BAJO_OBSERVACION')
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
      // NUMERIC llega como string desde pg
      horometroUltimo: fila.horometro_final === null ? null : Number(fila.horometro_final),
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
             baja.reemplazada_por,
             actual.operador, actual.id_turno AS id_turno_actual, actual.ubicacion, actual.id_area, actual.id_zona,
             actual.id_estado, actual.estado_operacional, actual.categoria_estado, actual.estado_desde,
             COALESCE(ultimo.horometro, m.horometro_inicial) AS horometro,
             m.regreso_estimado, m.id_maquina_respaldo, r.nombre AS respaldo, m.estado_previo_respaldo,
             cubierta.id_maquina AS id_cubre_a, cubierta.nombre AS cubre_a,
             m.version, m.actualizado_en, ua.nombre AS actualizado_por
      FROM maquina m
      LEFT JOIN usuario ua ON ua.id_usuario = m.actualizado_por
      LEFT JOIN maquina r ON r.id_maquina = m.id_maquina_respaldo
      LEFT JOIN maquina cubierta ON cubierta.id_maquina_respaldo = m.id_maquina
      LEFT JOIN asignacion_operador ao ON ao.id_maquina = m.id_maquina AND ao.vigente_hasta IS NULL
      LEFT JOIN operador oa ON oa.id_operador = ao.id_operador
      -- Por qué está en su estado (si no es ACTIVA): el último cambio de estado o reemplazo
      LEFT JOIN LATERAL (
        SELECT b.motivo, b.observacion, b.fecha, b.detalle ->> 'entrante' AS reemplazada_por
        FROM bitacora_jefe_turno b
        WHERE b.id_maquina = m.id_maquina AND b.accion IN ('HABILITAR', 'DESHABILITAR', 'CAMBIAR_ESTADO', 'REEMPLAZAR')
        ORDER BY b.fecha DESC
        LIMIT 1
      ) baja ON m.estado <> 'ACTIVA'
      LEFT JOIN LATERAL (
        SELECT o.nombre || ' ' || o.apellido AS operador, t.id_turno,
               COALESCE(z.nombre, a.nombre) AS ubicacion, tu.id_area, tu.id_zona,
               vigente.id_estado, vigente.nombre AS estado_operacional, vigente.categoria AS categoria_estado,
               vigente.inicio AS estado_desde
        FROM turno t
        JOIN operador o ON o.id_operador = t.id_operador
        LEFT JOIN turno_ubicacion tu ON tu.id_turno = t.id_turno AND tu.fin IS NULL
        LEFT JOIN area a ON a.id_area = tu.id_area
        LEFT JOIN zona_trabajo z ON z.id_zona = tu.id_zona
        -- Estado operacional vigente del turno: el último que empezó (un cambio offline puede llegar desordenado)
        LEFT JOIN LATERAL (
          SELECT te.id_estado, eo.nombre, eo.categoria, te.inicio
          FROM turno_estado te
          JOIN estado_operacional eo ON eo.id_estado = te.id_estado
          WHERE te.id_turno = t.id_turno
          ORDER BY te.inicio DESC
          LIMIT 1
        ) vigente ON TRUE
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
      motivoEstado:
        fila.motivo_baja === null || fila.fecha_baja === null
          ? null
          : { motivo: fila.motivo_baja, observacion: fila.observacion_baja, fecha: fila.fecha_baja, reemplazadaPor: fila.reemplazada_por },
      operadorActual: fila.operador,
      idTurnoActual: fila.id_turno_actual,
      estadoOperacional:
        fila.id_estado === null || fila.estado_desde === null
          ? null
          : { idEstado: fila.id_estado, nombre: fila.estado_operacional ?? '', categoria: fila.categoria_estado, desde: fila.estado_desde },
      ubicacionActual: fila.ubicacion,
      idAreaActual: fila.id_area,
      idZonaActual: fila.id_zona,
      // NUMERIC llega como string desde pg
      horometroActual: fila.horometro === null ? null : Number(fila.horometro),
      regresoEstimado: fila.regreso_estimado,
      respaldo:
        fila.id_maquina_respaldo === null
          ? null
          : {
              idMaquina: fila.id_maquina_respaldo,
              nombre: fila.respaldo ?? '',
              estadoAlDevolver: esEstadoMaquina(fila.estado_previo_respaldo) ? fila.estado_previo_respaldo : 'EN_RESERVA',
            },
      cubreA: fila.id_cubre_a === null ? null : { idMaquina: fila.id_cubre_a, nombre: fila.cubre_a ?? '' },
      version: fila.version,
      actualizadoEn: fila.actualizado_en,
      actualizadoPor: fila.actualizado_por,
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

  async reemplazar(reemplazo: ReemplazoMaquina): Promise<number> {
    return this.ormRepository.manager.transaction(async (manager) => {
      const idUsuario = reemplazo.accionesSaliente[0].idUsuario;
      await this.verificarVersiones(manager, reemplazo.versiones, idUsuario);
      const repo = manager.getRepository(MaquinaOrmEntity);
      const { entrante } = reemplazo;
      let idEntrante: number;
      if ('nueva' in entrante) {
        idEntrante = (await this.insertarMaquina(manager, entrante.nueva, idUsuario)).id_maquina;
      } else {
        idEntrante = entrante.idMaquina;
        if (entrante.habilitar) await repo.update({ id_maquina: idEntrante }, { estado: 'ACTIVA' });
      }
      await repo.update(
        { id_maquina: reemplazo.idSaliente },
        {
          estado: reemplazo.estadoSaliente,
          regreso_estimado: reemplazo.regresoEstimado,
          id_maquina_respaldo: idEntrante,
          estado_previo_respaldo: reemplazo.estadoPrevioEntrante,
        },
      );
      // La saliente queda sin operador; el elegido pasa a la entrante (cerrando la asignación que tuviera)
      await manager.query(
        `UPDATE asignacion_operador SET vigente_hasta = CURRENT_TIMESTAMP WHERE id_maquina = $1 AND vigente_hasta IS NULL`,
        [reemplazo.idSaliente],
      );
      await this.asignarOperador(manager, idEntrante, reemplazo.idOperador);
      await this.registrarAcciones(manager, reemplazo.idSaliente, reemplazo.accionesSaliente);
      await this.registrarAcciones(manager, idEntrante, reemplazo.accionesEntrante);
      await this.registrarAcciones(manager, idEntrante, reemplazo.accionesOtras);
      await this.subirVersiones(manager, this.otrasMaquinas(reemplazo.accionesOtras, reemplazo.versiones), idUsuario);
      return idEntrante;
    });
  }

  async devolver(devolucion: DevolucionMaquina): Promise<void> {
    await this.ormRepository.manager.transaction(async (manager) => {
      await this.verificarVersiones(manager, devolucion.versiones, devolucion.accionesOriginal[0].idUsuario);
      const repo = manager.getRepository(MaquinaOrmEntity);
      await repo.update(
        { id_maquina: devolucion.idOriginal },
        { estado: 'ACTIVA', regreso_estimado: null, id_maquina_respaldo: null, estado_previo_respaldo: null },
      );
      await repo.update({ id_maquina: devolucion.idRespaldo }, { estado: devolucion.estadoRespaldo });
      // El respaldo queda sin operador; el operador vuelve a la original
      await manager.query(
        `UPDATE asignacion_operador SET vigente_hasta = CURRENT_TIMESTAMP WHERE id_maquina = $1 AND vigente_hasta IS NULL`,
        [devolucion.idRespaldo],
      );
      await this.asignarOperador(manager, devolucion.idOriginal, devolucion.idOperador);
      await this.registrarAcciones(manager, devolucion.idOriginal, devolucion.accionesOriginal);
      await this.registrarAcciones(manager, devolucion.idRespaldo, devolucion.accionesRespaldo);
    });
  }

  private async insertarMaquina(
    manager: EntityManager,
    datos: Omit<NuevaMaquina, 'idOperador'>,
    idUsuario: number,
  ): Promise<MaquinaOrmEntity> {
    const repo = manager.getRepository(MaquinaOrmEntity);
    return repo.save(
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
        actualizado_en: new Date(),
        actualizado_por: idUsuario,
        id_cliente: datos.idCliente ?? null,
      }),
    );
  }

  async findIdPorIdCliente(idCliente: string): Promise<number | null> {
    const fila = await this.ormRepository.findOne({ where: { id_cliente: idCliente }, select: { id_maquina: true } });
    return fila?.id_maquina ?? null;
  }

  async existeAccionDeCliente(idCliente: string): Promise<boolean> {
    const [fila]: { existe: boolean }[] = await this.ormRepository.query(
      'SELECT EXISTS (SELECT 1 FROM bitacora_jefe_turno WHERE id_cliente = $1) AS existe',
      [idCliente],
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

  // Sube la versión de las máquinas validadas solo si siguen en la versión con que se validó la acción. El UPDATE
  // bloquea la fila hasta el fin de la transacción: una acción concurrente espera y luego ya no la encuentra
  private async verificarVersiones(manager: EntityManager, versiones: VersionEsperada[], idUsuario: number) {
    for (const { idMaquina, version } of versiones) {
      const resultado = await manager
        .createQueryBuilder()
        .update(MaquinaOrmEntity)
        .set({ version: () => 'version + 1', actualizado_en: () => 'CURRENT_TIMESTAMP', actualizado_por: idUsuario })
        .where('id_maquina = :idMaquina AND version = :version', { idMaquina, version })
        .execute();
      if (!resultado.affected) throw new MaquinaModificadaError(idMaquina);
    }
  }

  // Otras máquinas que la acción también cambia (p. ej. la que pierde a su operador): suben su versión sin validarla
  private async subirVersiones(manager: EntityManager, idsMaquina: number[], idUsuario: number) {
    if (idsMaquina.length === 0) return;
    await manager
      .createQueryBuilder()
      .update(MaquinaOrmEntity)
      .set({ version: () => 'version + 1', actualizado_en: () => 'CURRENT_TIMESTAMP', actualizado_por: idUsuario })
      .where('id_maquina IN (:...idsMaquina)', { idsMaquina })
      .execute();
  }

  private otrasMaquinas(acciones: AccionBitacora[], versiones: VersionEsperada[]): number[] {
    const validadas = new Set(versiones.map((v) => v.idMaquina));
    const otras = acciones.map((a) => a.idMaquina).filter((id): id is number => id !== undefined && !validadas.has(id));
    return [...new Set(otras)];
  }

  private async registrarAcciones(manager: EntityManager, idMaquina: number, acciones: AccionBitacora[]) {
    for (const accion of acciones) {
      await manager.query(
        `INSERT INTO bitacora_jefe_turno (accion, id_maquina, id_usuario, motivo, observacion, detalle, id_cliente)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          accion.accion,
          accion.idMaquina ?? idMaquina,
          accion.idUsuario,
          accion.motivo,
          accion.observacion,
          accion.detalle === null ? null : JSON.stringify(accion.detalle),
          accion.idCliente ?? null,
        ],
      );
    }
  }

  async actualizar(idMaquina: number, version: number, cambios: CambiosMaquina, acciones: AccionBitacora[]): Promise<void> {
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
      // En un estado sin regreso (de vuelta en operación, fuera de servicio) ya no hay regreso pendiente
      regreso_estimado: cambios.estado && !ESTADOS_CON_REGRESO.includes(cambios.estado) ? null : cambios.regresoEstimado,
    };
    // Solo las columnas que cambian (undefined = no se toca; null sí se guarda)
    const set = Object.fromEntries(Object.entries(columnas).filter(([, valor]) => valor !== undefined));
    await this.ormRepository.manager.transaction(async (manager) => {
      const versiones = [{ idMaquina, version }];
      const idUsuario = acciones[0].idUsuario;
      await this.verificarVersiones(manager, versiones, idUsuario);
      if (Object.keys(set).length > 0) await manager.getRepository(MaquinaOrmEntity).update({ id_maquina: idMaquina }, set);
      if (cambios.idOperador !== undefined) await this.asignarOperador(manager, idMaquina, cambios.idOperador);
      await this.registrarAcciones(manager, idMaquina, acciones);
      await this.subirVersiones(manager, this.otrasMaquinas(acciones, versiones), idUsuario);
    });
  }

  async create(datos: NuevaMaquina, registro: RegistroBitacora, acciones: AccionBitacora[] = []): Promise<MaquinaFlota> {
    const ormEntity = await this.ormRepository.manager.transaction(async (manager) => {
      const creada = await this.insertarMaquina(manager, datos, registro.idUsuario);
      await manager.query(
        `INSERT INTO bitacora_jefe_turno (accion, id_maquina, id_usuario, motivo, observacion, detalle)
         VALUES ('INCORPORAR', $1, $2, $3, $4, $5)`,
        [creada.id_maquina, registro.idUsuario, registro.motivo, registro.observacion, JSON.stringify({ ...datos, idCliente: undefined })],
      );
      if (datos.idOperador !== null) await this.asignarOperador(manager, creada.id_maquina, datos.idOperador);
      await this.registrarAcciones(manager, creada.id_maquina, acciones);
      await this.subirVersiones(manager, this.otrasMaquinas(acciones, [{ idMaquina: creada.id_maquina, version: 1 }]), registro.idUsuario);
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
  reemplazada_por: string | null;
  operador: string | null;
  id_turno_actual: number | null;
  id_estado: number | null;
  estado_operacional: string | null;
  categoria_estado: string | null;
  estado_desde: Date | null;
  ubicacion: string | null;
  id_area: number | null;
  id_zona: number | null;
  horometro: string | null;
  regreso_estimado: Date | null;
  id_maquina_respaldo: number | null;
  respaldo: string | null;
  estado_previo_respaldo: string | null;
  id_cubre_a: number | null;
  cubre_a: string | null;
  version: number;
  actualizado_en: Date | null;
  actualizado_por: string | null;
}

interface FilaMaquina {
  id_maquina: number;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  tipo_maquina: string | null;
  estado: string | null;
}
