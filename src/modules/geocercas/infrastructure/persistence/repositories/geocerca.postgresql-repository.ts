import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  AreaResumen,
  GeocercaRepositoryPort,
  ZonaTrabajoResumen,
} from '../../../domain/repositories/geocerca.repository.port';
import { AreaOrmEntity } from '../orm-entities/area.orm-entity';
import { ZonaTrabajoOrmEntity } from '../orm-entities/zona-trabajo.orm-entity';

// El polígono (PostGIS) no se selecciona: los listados solo necesitan los datos descriptivos.
const AREA_COLUMNS: (keyof AreaOrmEntity)[] = ['id_area', 'nombre', 'descripcion', 'estado'];
const ZONA_COLUMNS: (keyof ZonaTrabajoOrmEntity)[] = ['id_zona', 'id_area', 'nombre', 'descripcion', 'estado'];

@Injectable()
export class GeocercaPostgresqlRepository implements GeocercaRepositoryPort {
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

  async findZonaById(idZona: number): Promise<ZonaTrabajoResumen | null> {
    const zona = await this.zonaRepository.findOne({ select: ZONA_COLUMNS, where: { id_zona: idZona } });
    return zona ? this.mapZona(zona) : null;
  }

  private mapArea(area: AreaOrmEntity): AreaResumen {
    return { idArea: area.id_area, nombre: area.nombre, descripcion: area.descripcion, estado: area.estado };
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
