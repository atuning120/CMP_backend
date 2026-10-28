import { createHash } from 'node:crypto';
import type { CargaEp, CargaEpRepositoryPort, RegistroEp } from '../../domain/repositories/carga-ep.repository.port';
import type { ErrorFilaEp, LectorExcelEpPort } from '../../domain/ports/lector-excel-ep.port';
import { reporteError } from '../reporte.errors';

export const TAMANO_MAXIMO_EXCEL = 10 * 1024 * 1024;
const MAXIMO_DIAS_RANGO = 62;
const MAXIMO_ERRORES_INFORMADOS = 100;
const ROLES_CARGA = ['ADMIN', 'JEFE_TURNO'];

export interface ArchivoEp {
  buffer: Buffer;
  size: number;
  originalname?: string;
}

export interface SolicitudCargaEp {
  rol: string;
  periodo?: unknown; // AAAA-MM
  fechaDesde?: unknown; // AAAA-MM-DD
  fechaHasta?: unknown;
  archivo: ArchivoEp | undefined;
}

export interface EquipoCargaEp {
  equipo: string;
  registros: number;
  horas: number;
  enFlota: boolean; // existe una máquina con ese código interno
}

export interface ResumenCargaEp {
  periodo: string;
  fechaDesde: string;
  fechaHasta: string;
  archivo: string;
  hashSha256: string;
  registros: RegistroEp[]; // solo las filas válidas
  errores: ErrorFilaEp[]; // los primeros, ordenados por fila
  totalErrores: number;
  horas: number;
  equipos: EquipoCargaEp[];
  actividadesSinArea: string[];
  cargaExistente: CargaEp | null; // la que se reemplazaría al confirmar
}

export const exigirRolCarga = (rol: string) => {
  if (!ROLES_CARGA.includes(rol)) throw reporteError('SIN_PERMISO');
};

export const leerPeriodo = (valor: unknown): string => {
  if (typeof valor !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) throw reporteError('PERIODO_INVALIDO');
  return valor;
};

// Fecha AAAA-MM-DD que existe en el calendario, como milisegundos UTC; null si no lo es
const diaUtc = (valor: unknown): number | null => {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const ms = Date.parse(`${valor}T00:00:00Z`);
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== valor ? null : ms;
};

const DIA_MS = 24 * 60 * 60 * 1000;

// El EP no calza con el mes calendario (el de junio va del 25-05 al 25-06), pero tiene que cruzar ese mes
const leerRango = (desde: unknown, hasta: unknown, periodo: string) => {
  const ini = diaUtc(desde);
  const fin = diaUtc(hasta);
  const inicioMes = Date.parse(`${periodo}-01T00:00:00Z`);
  const [anio, mes] = periodo.split('-').map(Number);
  const finMes = Date.UTC(anio, mes, 0); // último día del mes
  if (ini === null || fin === null || fin < ini || (fin - ini) / DIA_MS + 1 > MAXIMO_DIAS_RANGO) throw reporteError('RANGO_INVALIDO');
  if (ini > finMes || fin < inicioMes) throw reporteError('RANGO_INVALIDO');
  return { fechaDesde: desde as string, fechaHasta: hasta as string };
};

// Un .xlsx es un ZIP: empieza con la firma PK\x03\x04. Se revisa el contenido y no el nombre que manda el cliente
const pareceXlsx = (buffer: Buffer) => buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;

// multer entrega el nombre en latin1: "Estado de pago Ñ.xlsx" llegaría con caracteres rotos
const nombreArchivo = (original: string | undefined) => {
  const nombre = Buffer.from(original ?? '', 'latin1').toString('utf8').replace(/[\\/\r\n]/g, '_').trim();
  return (nombre || 'estado-de-pago.xlsx').slice(0, 255);
};

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Valida la solicitud y lee el Excel sin guardar nada. La usan la vista previa y la confirmación: el archivo se
 * vuelve a enviar al confirmar, así el Backend no guarda archivos a medio cargar (traen datos personales).
 */
export const leerCargaEp = async (
  dto: SolicitudCargaEp,
  lector: LectorExcelEpPort,
  repo: CargaEpRepositoryPort,
): Promise<ResumenCargaEp> => {
  exigirRolCarga(dto.rol);
  const periodo = leerPeriodo(dto.periodo);
  const { fechaDesde, fechaHasta } = leerRango(dto.fechaDesde, dto.fechaHasta, periodo);
  const archivo = dto.archivo;
  if (!archivo || archivo.size > TAMANO_MAXIMO_EXCEL || !pareceXlsx(archivo.buffer)) throw reporteError('ARCHIVO_INVALIDO');

  const lectura = await lector.leer(archivo.buffer);
  if (!lectura) throw reporteError('ARCHIVO_INVALIDO');

  const errores = [...lectura.errores];
  const registros = lectura.registros.filter((r) => {
    const dentro = r.fecha >= fechaDesde && r.fecha <= fechaHasta;
    if (!dentro) errores.push({ fila: r.fila, mensaje: `La fecha ${r.fecha} está fuera del rango del estado de pago` });
    return dentro;
  });
  errores.sort((a, b) => (a.fila ?? 0) - (b.fila ?? 0));

  const porEquipo = new Map<string, { equipo: string; registros: number; horas: number }>();
  for (const r of registros) {
    const clave = r.equipo.toUpperCase();
    const actual = porEquipo.get(clave) ?? { equipo: r.equipo, registros: 0, horas: 0 };
    actual.registros += 1;
    actual.horas += r.horas;
    porEquipo.set(clave, actual);
  }
  const actividades = [...new Set(registros.map((r) => r.actividad).filter((a): a is string => !!a))];
  const [conocidos, actividadesSinArea, cargaExistente] = await Promise.all([
    porEquipo.size ? repo.equiposConocidos([...porEquipo.values()].map((e) => e.equipo)) : Promise.resolve([]),
    actividades.length ? repo.actividadesSinArea(actividades) : Promise.resolve([]),
    repo.buscarVigente(periodo),
  ]);
  const enFlota = new Set(conocidos.map((c) => c.toUpperCase()));

  return {
    periodo,
    fechaDesde,
    fechaHasta,
    archivo: nombreArchivo(archivo.originalname),
    hashSha256: createHash('sha256').update(archivo.buffer).digest('hex'),
    registros,
    errores: errores.slice(0, MAXIMO_ERRORES_INFORMADOS),
    totalErrores: errores.length,
    horas: redondear(registros.reduce((total, r) => total + r.horas, 0)),
    equipos: [...porEquipo.entries()]
      .map(([clave, e]) => ({ ...e, horas: redondear(e.horas), enFlota: enFlota.has(clave) }))
      .sort((a, b) => b.horas - a.horas),
    actividadesSinArea: actividadesSinArea.sort(),
    cargaExistente,
  };
};
