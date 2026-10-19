import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EntityManager } from 'typeorm';
import type {
  AreaMapa,
  AreaResumen,
  DatosGeocerca,
  DistintivoArea,
  EdicionGeocerca,
  GeocercaEscrituraPort,
  GeocercaRepositoryPort,
  PoligonoGeoJson,
  ZonaMapa,
  ZonaTrabajoResumen,
} from '../../../domain/repositories/geocerca.repository.port';
import { AreaOrmEntity } from '../orm-entities/area.orm-entity';
import { ZonaTrabajoOrmEntity } from '../orm-entities/zona-trabajo.orm-entity';

// El polígono (PostGIS) no se selecciona: los listados solo necesitan los datos descriptivos.
const AREA_COLUMNS: (keyof AreaOrmEntity)[] = ['id_area', 'nombre', 'descripcion', 'codigo', 'icono', 'estado'];
const ZONA_COLUMNS: (keyof ZonaTrabajoOrmEntity)[] = ['id_zona', 'id_area', 'nombre', 'descripcion', 'estado'];

// GeoJSON -> geometría PostGIS en WGS84 (el SRID de las columnas poligono)
const GEOM = (param: string) => `ST_SetSRID(ST_GeomFromGeoJSON(${param}), 4326)`;

interface FilaGeocercaMapa {
  id: number;
  id_area: number;
  nombre: string;
  descripcion: string | null;
  codigo?: string | null;
  icono?: string | null;
  estado: string | null;
  poligono: PoligonoGeoJson | null;
}

@Injectable()
export class GeocercaPostgresqlRepository implements GeocercaRepositoryPort, GeocercaEscrituraPort {
  constructor(
    @InjectRepository(AreaOrmEntity)
    private readonly areaRepository: Repository<AreaOrmEntity>,
    @InjectRepository(ZonaTrabajoOrmEntity)
    private readonly zonaRepository: Repository<ZonaTrabajoOrmEntity>,
  ) {}

  async findAreasActivas(): Promise<AreaResumen[]> {
    const areas = await this.areaRepository.find({
      select: AREA_COLUMNS,
      where: { estado: 'ACTIVA' },
      order: { nombre: 'ASC' },
    });
    return areas.map((area) => this.mapArea(area));
  }

  async findAreaById(idArea: number): Promise<AreaResumen | null> {
    const area = await this.areaRepository.findOne({ select: AREA_COLUMNS, where: { id_area: idArea } });
    return area ? this.mapArea(area) : null;
  }

  async findZonasActivasByArea(idArea: number): Promise<ZonaTrabajoResumen[]> {
    const zonas = await this.zonaRepository.find({
      select: ZONA_COLUMNS,
      where: { id_area: idArea, estado: 'ACTIVA' },
      order: { nombre: 'ASC' },
    });
    return zonas.map((zona) => this.mapZona(zona));
  }

  async findZonasActivas(): Promise<ZonaTrabajoResumen[]> {
    const zonas = await this.zonaRepository.find({
      select: ZONA_COLUMNS,
      where: { estado: 'ACTIVA' },
      order: { id_area: 'ASC', nombre: 'ASC' },
    });
    return zonas.map((zona) => this.mapZona(zona));
  }

  async findZonaById(idZona: number): Promise<ZonaTrabajoResumen | null> {
    const zona = await this.zonaRepository.findOne({ select: ZONA_COLUMNS, where: { id_zona: idZona } });
    return zona ? this.mapZona(zona) : null;
  }

  async findMapa(): Promise<{ areas: AreaMapa[]; zonas: ZonaMapa[] }> {
    const [areas, zonas]: [FilaGeocercaMapa[], FilaGeocercaMapa[]] = await Promise.all([
      this.areaRepository.query(
        `SELECT id_area AS id, id_area, nombre, descripcion, codigo, icono, estado, ST_AsGeoJSON(poligono)::json AS poligono
         FROM area WHERE estado = 'ACTIVA' ORDER BY nombre`,
      ),
      this.zonaRepository.query(
        `SELECT z.id_zona AS id, z.id_area, z.nombre, z.descripcion, z.estado, ST_AsGeoJSON(z.poligono)::json AS poligono
         FROM zona_trabajo z JOIN area a ON a.id_area = z.id_area AND a.estado = 'ACTIVA'
         WHERE z.estado = 'ACTIVA' ORDER BY z.id_area, z.nombre`,
      ),
    ]);
    return {
      areas: areas.map((f) => ({
        idArea: f.id,
        nombre: f.nombre,
        descripcion: f.descripcion,
        codigo: f.codigo ?? null,
        icono: f.icono ?? null,
        estado: f.estado,
        poligono: f.poligono,
      })),
      zonas: zonas.map((f) => ({
        idZona: f.id,
        idArea: f.id_area,
        nombre: f.nombre,
        descripcion: f.descripcion,
        estado: f.estado,
        poligono: f.poligono,
      })),
    };
  }

  async esPoligonoValido(poligono: PoligonoGeoJson): Promise<boolean> {
    const [fila] = await this.areaRepository.query(`SELECT ST_IsValid(${GEOM('$1')}) AS valido`, [JSON.stringify(poligono)]);
    return fila?.valido === true;
  }

  async zonaDentroDeArea(poligono: PoligonoGeoJson, idArea: number): Promise<boolean> {
    const [fila] = await this.areaRepository.query(
      `SELECT a.poligono IS NULL OR ST_CoveredBy(${GEOM('$1')}, a.poligono) AS dentro FROM area a WHERE a.id_area = $2`,
      [JSON.stringify(poligono), idArea],
    );
    return fila?.dentro === true;
  }

  async contarZonasFueraDe(idArea: number, poligono: PoligonoGeoJson): Promise<number> {
    const [fila] = await this.zonaRepository.query(
      `SELECT COUNT(*)::int AS total FROM zona_trabajo z
       WHERE z.id_area = $1 AND z.estado = 'ACTIVA' AND z.poligono IS NOT NULL
         AND NOT ST_CoveredBy(z.poligono, ${GEOM('$2')})`,
      [idArea, JSON.stringify(poligono)],
    );
    return fila?.total ?? 0;
  }

  async crearArea(datos: DatosGeocerca & DistintivoArea, idUsuario: number): Promise<number> {
    return this.areaRepository.manager.transaction(async (em) => {
      const [fila] = await em.query(
        `INSERT INTO area (nombre, descripcion, codigo, icono, poligono, estado, modificado_en, modificado_por)
         VALUES ($1, $2, $3, $4, ${GEOM('$5')}, 'ACTIVA', CURRENT_TIMESTAMP, $6) RETURNING id_area`,
        [datos.nombre, datos.descripcion, datos.codigo, datos.icono, JSON.stringify(datos.poligono), idUsuario],
      );
      await this.auditar(em, 'AREA', fila.id_area, 'CREAR', idUsuario);
      return fila.id_area;
    });
  }

  async editarArea(idArea: number, edicion: EdicionGeocerca & DistintivoArea, idUsuario: number): Promise<void> {
    await this.areaRepository.manager.transaction(async (em) => {
      await this.auditar(em, 'AREA', idArea, 'EDITAR', idUsuario);
      await em.query(
        `UPDATE area SET nombre = $2, descripcion = $3, codigo = $4, icono = $5,
                poligono = COALESCE(${GEOM('$6')}, poligono), modificado_en = CURRENT_TIMESTAMP, modificado_por = $7
         WHERE id_area = $1`,
        [
          idArea,
          edicion.nombre,
          edicion.descripcion,
          edicion.codigo,
          edicion.icono,
          edicion.poligono ? JSON.stringify(edicion.poligono) : null,
          idUsuario,
        ],
      );
    });
  }

  async desactivarArea(idArea: number, idUsuario: number): Promise<void> {
    await this.areaRepository.manager.transaction(async (em) => {
      const zonas: { id_zona: number }[] = await em.query(
        `SELECT id_zona FROM zona_trabajo WHERE id_area = $1 AND estado = 'ACTIVA'`,
        [idArea],
      );
      for (const { id_zona } of zonas) await this.auditar(em, 'ZONA', id_zona, 'DESACTIVAR', idUsuario);
      await this.auditar(em, 'AREA', idArea, 'DESACTIVAR', idUsuario);
      await em.query(
        `UPDATE zona_trabajo SET estado = 'INACTIVA', modificado_en = CURRENT_TIMESTAMP, modificado_por = $2
         WHERE id_area = $1 AND estado = 'ACTIVA'`,
        [idArea, idUsuario],
      );
      await em.query(
        `UPDATE area SET estado = 'INACTIVA', modificado_en = CURRENT_TIMESTAMP, modificado_por = $2 WHERE id_area = $1`,
        [idArea, idUsuario],
      );
    });
  }

  async crearZona(idArea: number, datos: DatosGeocerca, idUsuario: number): Promise<number> {
    return this.zonaRepository.manager.transaction(async (em) => {
      const [fila] = await em.query(
        `INSERT INTO zona_trabajo (id_area, nombre, descripcion, poligono, estado, modificado_en, modificado_por)
         VALUES ($1, $2, $3, ${GEOM('$4')}, 'ACTIVA', CURRENT_TIMESTAMP, $5) RETURNING id_zona`,
        [idArea, datos.nombre, datos.descripcion, JSON.stringify(datos.poligono), idUsuario],
      );
      await this.auditar(em, 'ZONA', fila.id_zona, 'CREAR', idUsuario);
      return fila.id_zona;
    });
  }

  async editarZona(idZona: number, edicion: EdicionGeocerca, idUsuario: number): Promise<void> {
    await this.zonaRepository.manager.transaction(async (em) => {
      await this.auditar(em, 'ZONA', idZona, 'EDITAR', idUsuario);
      await em.query(
        `UPDATE zona_trabajo SET nombre = $2, descripcion = $3, poligono = COALESCE(${GEOM('$4')}, poligono),
                modificado_en = CURRENT_TIMESTAMP, modificado_por = $5
         WHERE id_zona = $1`,
        [idZona, edicion.nombre, edicion.descripcion, edicion.poligono ? JSON.stringify(edicion.poligono) : null, idUsuario],
      );
    });
  }

  async desactivarZona(idZona: number, idUsuario: number): Promise<void> {
    await this.zonaRepository.manager.transaction(async (em) => {
      await this.auditar(em, 'ZONA', idZona, 'DESACTIVAR', idUsuario);
      await em.query(
        `UPDATE zona_trabajo SET estado = 'INACTIVA', modificado_en = CURRENT_TIMESTAMP, modificado_por = $2 WHERE id_zona = $1`,
        [idZona, idUsuario],
      );
    });
  }

  // Registra la acción con el polígono vigente antes del cambio (NULL al crear: no había uno anterior).
  // Se llama antes del UPDATE para capturar ese polígono
  private async auditar(
    em: EntityManager,
    entidad: 'AREA' | 'ZONA',
    id: number,
    accion: 'CREAR' | 'EDITAR' | 'DESACTIVAR',
    idUsuario: number,
  ): Promise<void> {
    const tabla = entidad === 'AREA' ? 'area' : 'zona_trabajo';
    const columnaId = entidad === 'AREA' ? 'id_area' : 'id_zona';
    await em.query(
      `INSERT INTO auditoria_geocerca (entidad, id_entidad, accion, poligono_anterior, id_usuario)
       SELECT $1, $2, $3, ${accion === 'CREAR' ? 'NULL' : 'poligono'}, $4 FROM ${tabla} WHERE ${columnaId} = $2`,
      [entidad, id, accion, idUsuario],
    );
  }

  private mapArea(area: AreaOrmEntity): AreaResumen {
    return {
      idArea: area.id_area,
      nombre: area.nombre,
      descripcion: area.descripcion,
      codigo: area.codigo,
      icono: area.icono,
      estado: area.estado,
    };
  }

  private mapZona(zona: ZonaTrabajoOrmEntity): ZonaTrabajoResumen {
    return {
      idZona: zona.id_zona,
      idArea: zona.id_area,
      nombre: zona.nombre,
      descripcion: zona.descripcion,
      estado: zona.estado,
    };
  }
}
