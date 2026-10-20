import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { HISTORIAL_REPOSITORY } from '../../domain/repositories/historial.repository.port';
import type { CursorHistorial, EventoHistorial, HistorialRepositoryPort } from '../../domain/repositories/historial.repository.port';
import { HISTORIAL_EXCEL } from '../../domain/ports/historial-excel.port';
import type { HistorialExcelPort } from '../../domain/ports/historial-excel.port';
import { leerRangoPaginado } from '../../../../shared/application/rango-paginado';
import { exigirRolHistorial, leerTipoHistorial } from './listar-historial.use-case';

export interface ExportarHistorialDto {
  rol: string;
  tipo?: unknown;
  desde?: unknown;
  hasta?: unknown;
  zonaHoraria?: unknown;
}

export interface ArchivoHistorial {
  contenido: Buffer;
  nombre: string;
}

// Los movimientos se leen en lotes con el mismo cursor de la paginación; el tope evita armar un archivo enorme en memoria
const LOTE = 1000;
export const MAXIMO_EVENTOS_EXCEL = 20000;
const ZONA_POR_DEFECTO = 'America/Santiago';

const zonaValida = (zona: unknown): string => {
  if (typeof zona !== 'string' || zona === '') return ZONA_POR_DEFECTO;
  try {
    new Intl.DateTimeFormat('es-CL', { timeZone: zona });
    return zona;
  } catch {
    return ZONA_POR_DEFECTO;
  }
};

// "YYYY-MM-DD" del día en la zona horaria del archivo
const diaLocal = (fecha: Date, zona: string) => fecha.toLocaleDateString('en-CA', { timeZone: zona });

const demasiados = () =>
  new BadRequestException({
    statusCode: 400,
    code: 'DEMASIADOS_EVENTOS',
    message: `El rango tiene más de ${MAXIMO_EVENTOS_EXCEL} registros: elige un rango más corto o un solo tipo`,
  });

@Injectable()
export class ExportarHistorialUseCase {
  constructor(
    @Inject(HISTORIAL_REPOSITORY)
    private readonly historialRepo: HistorialRepositoryPort,
    @Inject(HISTORIAL_EXCEL)
    private readonly historialExcel: HistorialExcelPort,
  ) {}

  async execute(dto: ExportarHistorialDto): Promise<ArchivoHistorial> {
    exigirRolHistorial(dto.rol, 'exportar el historial');

    const tipo = leerTipoHistorial(dto.tipo);
    const generado = new Date();
    // Mismo rango que la pantalla (máximo 90 días); "hasta ahora" queda fijo para que los lotes no se muevan
    const rango = leerRangoPaginado({ desde: dto.desde, hasta: dto.hasta });
    const hasta = rango.hasta ?? generado;
    const zonaHoraria = zonaValida(dto.zonaHoraria);

    // Turnos: lo que se concilia contra el reporte de la contratista. Movimientos: acciones sobre la flota
    const turnos =
      tipo === 'FLOTA' ? [] : await this.historialRepo.listarTurnos({ desde: rango.desde, hasta, limite: MAXIMO_EVENTOS_EXCEL + 1 });
    if (turnos.length > MAXIMO_EVENTOS_EXCEL) throw demasiados();
    const movimientos = tipo === 'TURNOS' ? [] : await this.leerMovimientos(rango.desde, hasta);

    const contenido = await this.historialExcel.generar({ turnos, movimientos }, { tipo, desde: rango.desde, hasta, generado, zonaHoraria });
    // hasta es exclusiva: el último día incluido es el anterior a ella
    const ultimoDia = diaLocal(new Date(hasta.getTime() - 1), zonaHoraria);
    const nombre = `historial_${tipo.toLowerCase()}_${diaLocal(rango.desde, zonaHoraria)}_${ultimoDia}.xlsx`;
    return { contenido, nombre };
  }

  // Acciones sobre la flota de todo el rango, del más antiguo al más reciente
  private async leerMovimientos(desde: Date, hasta: Date): Promise<EventoHistorial[]> {
    const eventos: EventoHistorial[] = [];
    let despuesDe: CursorHistorial | null = null;
    for (;;) {
      const lote = await this.historialRepo.listar({ incluirTurnos: false, incluirFlota: true, desde, hasta, despuesDe, limite: LOTE });
      eventos.push(...lote);
      if (eventos.length > MAXIMO_EVENTOS_EXCEL) throw demasiados();
      if (lote.length < LOTE) break;
      const ultimo = lote[lote.length - 1];
      despuesDe = { fecha: ultimo.fecha, id: ultimo.id };
    }
    return eventos.reverse();
  }
}
