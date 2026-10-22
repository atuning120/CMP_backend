import type { AlertaTurno, AlertaTurnoRepositoryPort, FiltroAlertas } from '../../domain/repositories/alerta-turno.repository.port';
import { DetectarAlertasNuevasUseCase } from './detectar-alertas-nuevas.use-case';

const alerta = (id: string): AlertaTurno => ({
  id,
  tipo: id.startsWith('A-') ? 'CIERRE_AUTOMATICO' : 'TURNO_EXTENDIDO',
  fecha: new Date(2026, 9, 7, 22, 0),
  operador: 'Cristian Núñez',
  maquina: { id: 3, nombre: 'CF-03' },
  turno: { id: 1, estado: 'EN_CURSO', horaInicio: new Date(2026, 9, 7, 12, 0), horaTermino: null, horometroInicial: 10, horometroFinal: null },
  area: 'Área 15',
  zona: null,
  jornada: null,
});

const crear = () => {
  const estado = { ids: [] as string[], activas: 0 };
  const alertaRepo = {
    listar: jest.fn(async (_filtro: FiltroAlertas) => estado.ids.map(alerta)),
    contarExtendidosEnCurso: jest.fn(async () => estado.activas),
  } satisfies AlertaTurnoRepositoryPort;
  return { estado, alertaRepo, detectar: new DetectarAlertasNuevasUseCase(alertaRepo) };
};

describe('DetectarAlertasNuevasUseCase', () => {
  it('la primera revisión solo registra las alertas que ya existían', async () => {
    const { estado, detectar } = crear();
    estado.ids = ['E-1', 'A-2'];
    estado.activas = 1;
    await expect(detectar.execute()).resolves.toBeNull();
    await expect(detectar.execute()).resolves.toBeNull();
  });

  it('avisa solo las alertas que no estaban en la revisión anterior', async () => {
    const { estado, detectar } = crear();
    estado.ids = ['E-1'];
    await detectar.execute();
    estado.ids = ['A-2', 'E-3', 'E-1'];
    estado.activas = 2;
    const novedad = await detectar.execute();
    expect(novedad?.nuevas.map((a) => a.id)).toEqual(['A-2', 'E-3']);
    expect(novedad?.activas).toBe(2);
  });

  it('avisa un cambio del contador aunque no haya alertas nuevas', async () => {
    const { estado, detectar } = crear();
    estado.ids = ['E-1'];
    estado.activas = 1;
    await detectar.execute();
    estado.activas = 0;
    await expect(detectar.execute()).resolves.toEqual({ nuevas: [], activas: 0 });
  });

  it('busca en las últimas 24 h, ambos tipos y sin paginar', async () => {
    const { alertaRepo, detectar } = crear();
    const ahora = new Date(2026, 9, 8, 12, 0);
    await detectar.execute(ahora);
    expect(alertaRepo.listar).toHaveBeenCalledWith(
      expect.objectContaining({
        incluirExtendidos: true,
        incluirCierresAutomaticos: true,
        desde: new Date(2026, 9, 7, 12, 0),
        hasta: null,
        despuesDe: null,
      }),
    );
  });
});
