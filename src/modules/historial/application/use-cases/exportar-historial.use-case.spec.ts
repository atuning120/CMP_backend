import type {
  EventoHistorial,
  FiltroHistorial,
  FiltroTurnosConciliacion,
  HistorialRepositoryPort,
  TurnoConciliacion,
} from '../../domain/repositories/historial.repository.port';
import type { ContenidoExcelHistorial, DatosExcelHistorial, HistorialExcelPort } from '../../domain/ports/historial-excel.port';
import { ExportarHistorialUseCase, MAXIMO_EVENTOS_EXCEL } from './exportar-historial.use-case';

// Del más reciente al más antiguo, como los entrega el repositorio
const evento = (n: number): EventoHistorial => ({
  id: `B-${n}`,
  tipo: 'CAMBIAR_ESTADO',
  fecha: new Date(Date.UTC(2026, 9, 7, 12, 0, 0) - n * 1000),
  actor: 'Pedro Soto',
  maquina: { id: 1, nombre: 'CF-01' },
  motivo: null,
  observacion: null,
  detalle: null,
});

const turno = (n: number): TurnoConciliacion => ({
  idTurno: n,
  horaInicio: new Date(Date.UTC(2026, 9, 1, 10) + n * 3600000),
  horaTermino: null,
  estado: 'EN_CURSO',
  horometroInicial: 100,
  horometroFinal: null,
  equipo: { codigo: 'CF-01', patente: null, numeroChasis: null, tipo: 'Cargador Frontal', esContratista: true },
  operador: 'María López',
  ubicaciones: [],
  estados: [],
  conflicto: null,
  cerradoPor: null,
  motivoCierre: null,
});

// El repositorio respeta límite y cursor sobre listas fijas
const crear = ({ movimientos = 0, turnos = 0 } = {}) => {
  const eventos = Array.from({ length: movimientos }, (_, i) => evento(i));
  const listaTurnos = Array.from({ length: turnos }, (_, i) => turno(i));
  const historialRepo = {
    listar: jest.fn(async (filtro: FiltroHistorial) => {
      const desde = filtro.despuesDe ? eventos.findIndex((e) => e.id === filtro.despuesDe!.id) + 1 : 0;
      return eventos.slice(desde, desde + filtro.limite);
    }),
    listarTurnos: jest.fn(async (filtro: FiltroTurnosConciliacion) => listaTurnos.slice(0, filtro.limite)),
  } satisfies HistorialRepositoryPort;
  const historialExcel = {
    generar: jest.fn(async (_contenido: ContenidoExcelHistorial, _datos: DatosExcelHistorial) => Buffer.from('xlsx')),
  } satisfies HistorialExcelPort;
  return { historialRepo, historialExcel, exportar: new ExportarHistorialUseCase(historialRepo, historialExcel) };
};

describe('ExportarHistorialUseCase', () => {
  const desde = '2026-10-01T03:00:00.000Z';
  const hasta = '2026-10-08T03:00:00.000Z';

  it('solo jefe de turno o administrador', async () => {
    const { exportar, historialRepo } = crear();
    await expect(exportar.execute({ rol: 'OPERADOR' })).rejects.toThrow('exportar el historial');
    await expect(exportar.execute({ rol: 'VISOR' })).rejects.toThrow();
    expect(historialRepo.listar).not.toHaveBeenCalled();
    expect(historialRepo.listarTurnos).not.toHaveBeenCalled();
    await expect(exportar.execute({ rol: 'ADMIN' })).resolves.toMatchObject({ contenido: Buffer.from('xlsx') });
  });

  it('TODO lleva los turnos del rango y todos los movimientos de flota, del más antiguo al más reciente', async () => {
    const { exportar, historialRepo, historialExcel } = crear({ movimientos: 2500, turnos: 3 });
    await exportar.execute({ rol: 'JEFE_TURNO', desde, hasta });

    expect(historialRepo.listarTurnos).toHaveBeenCalledWith({ desde: new Date(desde), hasta: new Date(hasta), limite: MAXIMO_EVENTOS_EXCEL + 1 });
    expect(historialRepo.listar).toHaveBeenCalledTimes(3);
    expect(historialRepo.listar).toHaveBeenNthCalledWith(1, {
      incluirTurnos: false,
      incluirFlota: true,
      desde: new Date(desde),
      hasta: new Date(hasta),
      despuesDe: null,
      limite: 1000,
    });
    expect(historialRepo.listar).toHaveBeenNthCalledWith(2, expect.objectContaining({ despuesDe: { fecha: evento(999).fecha, id: 'B-999' } }));

    const [{ turnos, movimientos }, datos] = historialExcel.generar.mock.calls[0];
    expect(turnos).toHaveLength(3);
    expect(movimientos.map((e) => e.id)).toEqual(Array.from({ length: 2500 }, (_, i) => `B-${2499 - i}`));
    expect(datos).toMatchObject({ tipo: 'TODO', desde: new Date(desde), hasta: new Date(hasta), zonaHoraria: 'America/Santiago' });
  });

  it('TURNOS no lee movimientos y FLOTA no lee turnos', async () => {
    const soloTurnos = crear({ movimientos: 5, turnos: 2 });
    await soloTurnos.exportar.execute({ rol: 'JEFE_TURNO', tipo: 'TURNOS', desde, hasta });
    expect(soloTurnos.historialRepo.listar).not.toHaveBeenCalled();
    expect(soloTurnos.historialExcel.generar.mock.calls[0][0]).toMatchObject({ movimientos: [] });

    const soloFlota = crear({ movimientos: 5, turnos: 2 });
    await soloFlota.exportar.execute({ rol: 'JEFE_TURNO', tipo: 'FLOTA', desde, hasta });
    expect(soloFlota.historialRepo.listarTurnos).not.toHaveBeenCalled();
    expect(soloFlota.historialExcel.generar.mock.calls[0][0]).toMatchObject({ turnos: [] });
  });

  it('sin hasta fija "ahora" para todas las consultas', async () => {
    const { exportar, historialRepo, historialExcel } = crear({ movimientos: 1500 });
    await exportar.execute({ rol: 'JEFE_TURNO', desde });
    const [primero, segundo] = historialRepo.listar.mock.calls.map(([filtro]) => filtro.hasta);
    expect(primero).toBeInstanceOf(Date);
    expect(segundo).toBe(primero);
    expect(historialRepo.listarTurnos.mock.calls[0][0].hasta).toBe(primero);
    expect(historialExcel.generar.mock.calls[0][1].hasta).toBe(primero);
  });

  it('nombra el archivo con el tipo y los días incluidos en la hora local', async () => {
    const { exportar } = crear();
    // 01/10 00:00 al 08/10 00:00 en Chile (UTC-3): hasta es exclusiva, el último día es el 07/10
    const { nombre } = await exportar.execute({ rol: 'JEFE_TURNO', tipo: 'FLOTA', desde, hasta, zonaHoraria: 'America/Santiago' });
    expect(nombre).toBe('historial_flota_2026-10-01_2026-10-07.xlsx');
  });

  it('una zona horaria inválida usa la de Chile', async () => {
    const { exportar, historialExcel } = crear();
    await exportar.execute({ rol: 'JEFE_TURNO', desde, hasta, zonaHoraria: 'Marte/Olympus' });
    expect(historialExcel.generar.mock.calls[0][1].zonaHoraria).toBe('America/Santiago');
  });

  it('rechaza rangos inválidos y demasiados registros', async () => {
    const { exportar } = crear();
    await expect(exportar.execute({ rol: 'JEFE_TURNO', desde: '2026-06-01T04:00:00.000Z', hasta })).rejects.toThrow('90 días');

    const muchosMovimientos = crear({ movimientos: MAXIMO_EVENTOS_EXCEL + 1 });
    await expect(muchosMovimientos.exportar.execute({ rol: 'JEFE_TURNO', tipo: 'FLOTA', desde, hasta })).rejects.toThrow('rango más corto');
    expect(muchosMovimientos.historialExcel.generar).not.toHaveBeenCalled();

    const muchosTurnos = crear({ turnos: MAXIMO_EVENTOS_EXCEL + 1 });
    await expect(muchosTurnos.exportar.execute({ rol: 'JEFE_TURNO', tipo: 'TURNOS', desde, hasta })).rejects.toThrow('rango más corto');
  });
});
