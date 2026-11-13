import { AlertasEnVivoScheduler } from './alertas-en-vivo.scheduler';
import type { DetectarAlertasNuevasUseCase } from '../../application/use-cases/detectar-alertas-nuevas.use-case';
import type { NovedadAlertas, PublicadorAlertasPort } from '../../application/ports/publicador-alertas.port';

const NOVEDAD = { nuevas: [], activas: 1 } as unknown as NovedadAlertas;

const crear = (detectar: () => Promise<NovedadAlertas | null> = async () => NOVEDAD) => {
  const execute = jest.fn(detectar);
  const publicar = jest.fn();
  const scheduler = new AlertasEnVivoScheduler(
    { execute } as unknown as DetectarAlertasNuevasUseCase,
    { publicar } as unknown as PublicadorAlertasPort,
  );
  return { scheduler, execute, publicar };
};

// Deja correr las promesas pendientes (la revisión es async)
const vaciar = () => new Promise((r) => jest.requireActual<typeof globalThis>('timers').setImmediate(r));

describe('AlertasEnVivoScheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('revisa al instante (tras una espera corta) cuando cambia un turno y publica la novedad', async () => {
    const { scheduler, execute, publicar } = crear();
    scheduler.alCambiarTurnos();
    expect(execute).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    await vaciar();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(publicar).toHaveBeenCalledWith(NOVEDAD);
  });

  it('junta en una sola revisión una ráfaga de cambios', async () => {
    const { scheduler, execute } = crear();
    for (let i = 0; i < 10; i++) scheduler.alCambiarTurnos();
    jest.advanceTimersByTime(300);
    await vaciar();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('un cambio que llega durante una revisión dispara otra al terminar', async () => {
    let terminar: (v: NovedadAlertas | null) => void = () => {};
    const { scheduler, execute } = crear(() => new Promise((r) => (terminar = r)));
    scheduler.alCambiarTurnos();
    jest.advanceTimersByTime(300);
    await vaciar();
    expect(execute).toHaveBeenCalledTimes(1);
    // Llega otro cambio mientras la primera revisión sigue en curso
    scheduler.alCambiarTurnos();
    jest.advanceTimersByTime(300);
    await vaciar();
    expect(execute).toHaveBeenCalledTimes(1);
    terminar(null);
    await vaciar();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('sin novedad no publica', async () => {
    const { scheduler, publicar } = crear(async () => null);
    scheduler.alCambiarTurnos();
    jest.advanceTimersByTime(300);
    await vaciar();
    expect(publicar).not.toHaveBeenCalled();
  });
});
