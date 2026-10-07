import type { EventoHistorial, HistorialRepositoryPort } from '../../domain/repositories/historial.repository.port';
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
    listar: jest.fn(async () => Array.from({ length: cantidad }, (_, i) => evento(i))),
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
    await listar.execute({ rol: 'JEFE_TURNO', tipo: 'FLOTA', limite: '500', antes: 'no-es-fecha' });
    expect(historialRepo.listar).toHaveBeenLastCalledWith({ incluirTurnos: false, incluirFlota: true, antesDe: null, limite: 51 });
    await listar.execute({ rol: 'JEFE_TURNO', tipo: 'TURNOS', antes: '2026-10-07T12:00:00.000Z' });
    expect(historialRepo.listar).toHaveBeenLastCalledWith({
      incluirTurnos: true,
      incluirFlota: false,
      antesDe: new Date('2026-10-07T12:00:00.000Z'),
      limite: 31,
    });
  });

  it('indica si hay más páginas', async () => {
    const { listar } = crear(4);
    const pagina = await listar.execute({ rol: 'JEFE_TURNO', limite: 3 });
    expect(pagina.eventos).toHaveLength(3);
    expect(pagina.hayMas).toBe(true);
  });
});
