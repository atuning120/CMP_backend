import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MaquinaFlota, MaquinaRepositoryPort, MaquinaResumen, NuevaMaquina, RegistroBitacora } from '../../../domain/repositories/maquina.repository.port';
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

  async findActivas(): Promise<MaquinaResumen[]> {
    const ormEntities = await this.ormRepository.find({
      where: { estado: 'ACTIVA' },
      order: { nombre: 'ASC' },
    });
    return ormEntities.map((ormEntity) => this.mapToResumen(ormEntity));
  }

  async findFlota(busqueda: string | null): Promise<MaquinaFlota[]> {
    // Se escapan los comodines de LIKE para buscar el texto literal
    const patron = busqueda ? `%${busqueda.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const filas: FilaFlota[] = await this.ormRepository.query(
      `
      SELECT m.id_maquina, m.nombre, m.marca, m.modelo, m.tipo_maquina, m.estado, m.patente,
             actual.operador, actual.ubicacion,
             COALESCE(ultimo.horometro, m.horometro_inicial) AS horometro
      FROM maquina m
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
      WHERE $1::text IS NULL
         OR m.nombre ILIKE $1 OR m.marca ILIKE $1 OR m.modelo ILIKE $1 OR m.tipo_maquina ILIKE $1
         OR m.patente ILIKE $1
      ORDER BY m.nombre ASC
      `,
      [patron],
    );
    return filas.map((fila) => ({
      idMaquina: fila.id_maquina,
      nombre: fila.nombre,
      marca: fila.marca,
      modelo: fila.modelo,
      tipoMaquina: fila.tipo_maquina,
      estado: fila.estado,
      patente: fila.patente,
      operadorActual: fila.operador,
      ubicacionActual: fila.ubicacion,
      // NUMERIC llega como string desde pg
      horometroActual: fila.horometro === null ? null : Number(fila.horometro),
    }));
  }

  async existeNombre(nombre: string): Promise<boolean> {
    return this.ormRepository.createQueryBuilder('m').where('UPPER(m.nombre) = UPPER(:nombre)', { nombre }).getExists();
  }

  async existePatente(patente: string): Promise<boolean> {
    return this.ormRepository.createQueryBuilder('m').where('UPPER(m.patente) = UPPER(:patente)', { patente }).getExists();
  }

  async create(datos: NuevaMaquina, registro: RegistroBitacora): Promise<MaquinaFlota> {
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
      return creada;
    });
    // Recién incorporada: aún no tiene turnos, así que nadie la opera
    return {
      ...this.mapToResumen(ormEntity),
      patente: ormEntity.patente,
      operadorActual: null,
      ubicacionActual: null,
      horometroActual: datos.horometroInicial,
    };
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
  operador: string | null;
  ubicacion: string | null;
  horometro: string | null;
}
