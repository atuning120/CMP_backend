import type { EventoHistorial, FiltroHistorial, HistorialRepositoryPort } from '../../domain/repositories/historial.repository.port';
import { ListarHistorialUseCase } from './listar-historial.use-case';

const evento = (n: number): EventoHistorial => ({
  id: `T-${n}`,
  tipo: 'INICIO_TURNO',
  fecha: new Date(2026, 9, 7, 12, 0, n),
  actor: 'María López',
  maquina: { id: 1, nombre: 'CF-01' },
  motivo: null,
  observacion: null,
  detalle: null,
});

const crear = (cantidad = 0) => {
  const historialRepo = {
    listar: jest.fn(async (_filtro: FiltroHistorial) => Array.from({ length: cantidad }, (_, i) => evento(i))),
  } satisfies HistorialRepositoryPort;
  return { historialRepo, listar: new ListarHistorialUseCase(historialRepo) };
};

describe('ListarHistorialUseCase', () => {
  it('solo jefe de turno o administrador', async () => {
    const { listar } = crear();
    await expect(listar.execute({ rol: 'OPERADOR' })).rejects.toThrow();
    await expect(listar.execute({ rol: 'ADMIN' })).resolves.toEqual({ eventos: [], hayMas: false });
  });

  it('traduce el filtro de tipo y normaliza límite y cursor', async () => {
    const { historialRepo, listar } = crear();
    const desde = '2026-10-01T03:00:00.000Z';
    const hasta = '2026-10-08T03:00:00.000Z';
    await listar.execute({ rol: 'JEFE_TURNO', tipo: 'FLOTA', desde, hasta, limite: '500', antes: 'no-es-fecha' });
    expect(historialRepo.listar).toHaveBeenLastCalledWith({
      incluirTurnos: false,
      incluirFlota: true,
      desde: new Date(desde),
      hasta: new Date(hasta),
      despuesDe: null,
      limite: 51,
    });
    await listar.execute({ rol: 'JEFE_TURNO', tipo: 'TURNOS', desde, antes: '2026-10-07T12:00:00.000Z', antesId: 'T-4' });
    expect(historialRepo.listar).toHaveBeenLastCalledWith({
      incluirTurnos: true,
      incluirFlota: false,
      desde: new Date(desde),
      hasta: null,
      despuesDe: { fecha: new Date('2026-10-07T12:00:00.000Z'), id: 'T-4' },
      limite: 31,
    });
  });

  it('sin antesId el cursor deja fuera los eventos con la misma fecha (versión anterior de la app)', async () => {
    const { historialRepo, listar } = crear();
    await listar.execute({ rol: 'JEFE_TURNO', antes: '2026-10-07T12:00:00.000Z' });
    expect(historialRepo.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ despuesDe: { fecha: new Date('2026-10-07T12:00:00.000Z'), id: '' } }),
    );
  });

  it('sin rango usa los últimos 7 días', async () => {
    const { historialRepo, listar } = crear();
    const antes = Date.now();
    await listar.execute({ rol: 'JEFE_TURNO' });
    const { desde, hasta } = historialRepo.listar.mock.calls[0][0];
    expect(hasta).toBeNull();
    expect(antes - desde.getTime()).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
    expect(antes - desde.getTime()).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('rechaza rangos inválidos o de más de 90 días', async () => {
    const { historialRepo, listar } = crear();
    await expect(listar.execute({ rol: 'JEFE_TURNO', desde: 'ayer' })).rejects.toThrow('no son válidas');
    await expect(
      listar.execute({ rol: 'JEFE_TURNO', desde: '2026-10-08T03:00:00.000Z', hasta: '2026-10-01T03:00:00.000Z' }),
    ).rejects.toThrow('anterior');
    await expect(
      listar.execute({ rol: 'JEFE_TURNO', desde: '2026-06-01T04:00:00.000Z', hasta: '2026-10-01T03:00:00.000Z' }),
    ).rejects.toThrow('90 días');
    // 90 días exactos con cambio de horario de por medio (una hora de diferencia) sí se aceptan
    await listar.execute({ rol: 'JEFE_TURNO', desde: '2026-07-03T04:00:00.000Z', hasta: '2026-10-01T03:00:00.000Z' });
    expect(historialRepo.listar).toHaveBeenCalledTimes(1);
  });

  it('indica si hay más páginas', async () => {
    const { listar } = crear(4);
    const pagina = await listar.execute({ rol: 'JEFE_TURNO', limite: 3 });
    expect(pagina.eventos).toHaveLength(3);
    expect(pagina.hayMas).toBe(true);
  });
});
