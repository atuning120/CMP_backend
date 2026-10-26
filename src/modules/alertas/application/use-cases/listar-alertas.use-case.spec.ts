import type { AlertaTurno, AlertaTurnoRepositoryPort, FiltroAlertas } from '../../domain/repositories/alerta-turno.repository.port';
import { ListarAlertasUseCase } from './listar-alertas.use-case';

const alerta = (n: number): AlertaTurno => ({
  id: `E-${n}`,
  tipo: 'TURNO_EXTENDIDO',
  fecha: new Date(2026, 9, 7, 22, 0, n),
  operador: 'Cristian Núñez',
  maquina: { id: 3, nombre: 'CF-03' },
  turno: { id: n, estado: 'EN_CURSO', horaInicio: new Date(2026, 9, 7, 12, 0, n), horaTermino: null, horometroInicial: 10, horometroFinal: null },
  area: 'Área 15',
  zona: null,
  jornada: null,
  atenciones: [],
});

const crear = (cantidad = 0, activas = 0) => {
  const alertaRepo = {
    listar: jest.fn(async (_filtro: FiltroAlertas) => Array.from({ length: cantidad }, (_, i) => alerta(i))),
    contarExtendidosEnCurso: jest.fn(async () => activas),
    existe: jest.fn(async () => true),
  } satisfies AlertaTurnoRepositoryPort;
  return { alertaRepo, listar: new ListarAlertasUseCase(alertaRepo) };
};

describe('ListarAlertasUseCase', () => {
  it('solo jefe de turno o administrador', async () => {
    const { listar } = crear();
    await expect(listar.execute({ rol: 'OPERADOR' })).rejects.toThrow();
    await expect(listar.execute({ rol: 'ADMIN' })).resolves.toEqual({ alertas: [], hayMas: false, activas: 0 });
  });

  it('traduce el filtro de tipo, el rango y el cursor', async () => {
    const { alertaRepo, listar } = crear();
    const desde = '2026-10-01T03:00:00.000Z';
    await listar.execute({ rol: 'JEFE_TURNO', tipo: 'CIERRES_AUTOMATICOS', desde, antes: '2026-10-07T12:00:00.000Z', antesId: 'A-4' });
    expect(alertaRepo.listar).toHaveBeenLastCalledWith({
      incluirExtendidos: false,
      incluirCierresAutomaticos: true,
      estado: 'TODAS',
      desde: new Date(desde),
      hasta: null,
      despuesDe: { fecha: new Date('2026-10-07T12:00:00.000Z'), id: 'A-4' },
      limite: 31,
    });
    await listar.execute({ rol: 'JEFE_TURNO', tipo: 'EXTENDIDOS', desde });
    expect(alertaRepo.listar).toHaveBeenLastCalledWith(expect.objectContaining({ incluirExtendidos: true, incluirCierresAutomaticos: false }));
  });

  it('rechaza un rango inválido', async () => {
    const { listar } = crear();
    await expect(listar.execute({ rol: 'JEFE_TURNO', desde: 'ayer' })).rejects.toThrow('no son válidas');
  });

  it('indica si hay más páginas y cuántas alertas siguen activas', async () => {
    const { listar } = crear(4, 2);
    const pagina = await listar.execute({ rol: 'JEFE_TURNO', limite: 3 });
    expect(pagina.alertas).toHaveLength(3);
    expect(pagina.hayMas).toBe(true);
    expect(pagina.activas).toBe(2);
  });
});

describe('ListarAlertasUseCase: filtro por atención', () => {
  it.each([
    ['PENDIENTES', 'PENDIENTES'],
    ['ATENDIDAS', 'ATENDIDAS'],
    ['otra cosa', 'TODAS'],
    [undefined, 'TODAS'],
  ])('estado %p -> %p', async (estado, esperado) => {
    const { alertaRepo, listar } = crear();
    await listar.execute({ rol: 'JEFE_TURNO', estado });
    expect(alertaRepo.listar).toHaveBeenLastCalledWith(expect.objectContaining({ estado: esperado }));
  });
});
