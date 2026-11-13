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
  detencion: null,
  atenciones: [],
});

const crear = () => {
  // cambios: lo que cambió de cada alerta respecto de su forma base (p. ej. la detención terminó)
  const estado = { ids: [] as string[], activas: 0, cambios: {} as Record<string, Partial<AlertaTurno>> };
  const alertaRepo = {
    listar: jest.fn(async (_filtro: FiltroAlertas) => estado.ids.map((id) => ({ ...alerta(id), ...estado.cambios[id] }))),
    contarActivas: jest.fn(async () => estado.activas),
    turnoDeAlerta: jest.fn(async (_tipo: string, id: number) => id),
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
    await expect(detectar.execute()).resolves.toEqual({ nuevas: [], actualizadas: [], activas: 0 });
  });

  it('avisa como actualizada una alerta ya conocida que cambió de estado (la máquina salió de la falla)', async () => {
    const { estado, detectar } = crear();
    const falla = { tipo: 'MANTENCION' as const, detencion: { estado: 'Falla', inicio: new Date(2026, 9, 7, 13, 0), fin: null } };
    estado.ids = ['M-7'];
    estado.cambios['M-7'] = falla;
    estado.activas = 1;
    await detectar.execute();
    // Pasa a demora: la detención termina y otra falla posterior es una alerta nueva
    estado.ids = ['M-9', 'M-7'];
    estado.cambios['M-7'] = { ...falla, detencion: { ...falla.detencion, fin: new Date(2026, 9, 7, 13, 5) } };
    estado.cambios['M-9'] = falla;
    const novedad = await detectar.execute();
    expect(novedad?.nuevas.map((a) => a.id)).toEqual(['M-9']);
    expect(novedad?.actualizadas.map((a) => a.id)).toEqual(['M-7']);
    expect(novedad?.actualizadas[0].detencion?.fin).toEqual(new Date(2026, 9, 7, 13, 5));
  });

  it('el cierre del turno actualiza su alerta de turno extendido', async () => {
    const { estado, detectar } = crear();
    estado.ids = ['E-1'];
    await detectar.execute();
    estado.cambios['E-1'] = { turno: { ...alerta('E-1').turno, estado: 'FINALIZADO', horaTermino: new Date(2026, 9, 7, 23, 0) } };
    const novedad = await detectar.execute();
    expect(novedad?.actualizadas.map((a) => a.id)).toEqual(['E-1']);
  });

  it('las horas de la jornada que corren no cuentan como cambio', async () => {
    const { estado, detectar } = crear();
    estado.ids = ['J-1'];
    estado.cambios['J-1'] = { tipo: 'JORNADA_EXTENDIDA', jornada: { inicio: new Date(2026, 9, 7, 8, 0), turnos: 2, horas: 10.5 } };
    await detectar.execute();
    estado.cambios['J-1'] = { tipo: 'JORNADA_EXTENDIDA', jornada: { inicio: new Date(2026, 9, 7, 8, 0), turnos: 2, horas: 10.75 } };
    await expect(detectar.execute()).resolves.toBeNull();
  });

  it('busca en las últimas 24 h, todos los tipos y sin paginar', async () => {
    const { alertaRepo, detectar } = crear();
    const ahora = new Date(2026, 9, 8, 12, 0);
    await detectar.execute(ahora);
    expect(alertaRepo.listar).toHaveBeenCalledWith(
      expect.objectContaining({
        incluirExtendidos: true,
        incluirCierresAutomaticos: true,
        incluirMantenciones: true,
        desde: new Date(2026, 9, 7, 12, 0),
        hasta: null,
        despuesDe: null,
      }),
    );
  });
});
