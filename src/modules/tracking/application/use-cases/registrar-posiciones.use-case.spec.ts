import type { PosicionDispositivo, PosicionMaquina } from '../../domain/entities/posicion-gps';
import type { TrackingRepositoryPort } from '../../domain/repositories/tracking.repository.port';
import type { PublicadorPosicionesPort } from '../ports/publicador-posiciones.port';
import { RegistrarPosicionesUseCase, validarPosicion } from './registrar-posiciones.use-case';

const AHORA = new Date('2026-10-21T13:00:00.000Z');

const entrante = (cambios: Record<string, unknown> = {}) => ({
  imei: '900000000000012',
  fechaHora: '2026-10-21T12:58:00.000Z',
  latitud: -28.2999,
  longitud: -70.8085,
  velocidad: 12,
  rumbo: 90,
  bateria: 83,
  satelites: 9,
  enTiempoReal: true,
  tramaHex: '7878',
  ...cambios,
});

const crear = () => {
  const trackingRepo = {
    guardar: jest.fn(async (posiciones: PosicionDispositivo[]): Promise<PosicionMaquina[]> =>
      posiciones.map((p) => ({ idMaquina: 12, fechaHora: p.fechaHora, latitud: p.latitud, longitud: p.longitud, velocidad: p.velocidad, rumbo: p.rumbo, bateria: p.bateria })),
    ),
    ultimasPorMaquina: jest.fn(async () => []),
  } satisfies TrackingRepositoryPort;
  const publicador = { publicar: jest.fn() } satisfies PublicadorPosicionesPort;
  return { trackingRepo, publicador, registrar: new RegistrarPosicionesUseCase(trackingRepo, publicador) };
};

describe('validarPosicion', () => {
  it('acepta una posición completa', () => {
    expect(validarPosicion(entrante(), AHORA)).toEqual(
      expect.objectContaining({ imei: '900000000000012', fechaHora: new Date('2026-10-21T12:58:00.000Z'), latitud: -28.2999 }),
    );
  });

  it('rechaza IMEI, coordenadas o fechas inválidas', () => {
    expect(validarPosicion(entrante({ imei: 'APP-12' }), AHORA)).toBeNull();
    expect(validarPosicion(entrante({ latitud: 91 }), AHORA)).toBeNull();
    expect(validarPosicion(entrante({ latitud: 0, longitud: 0 }), AHORA)).toBeNull();
    expect(validarPosicion(entrante({ fechaHora: 'ayer' }), AHORA)).toBeNull();
    expect(validarPosicion(entrante({ fechaHora: '2026-10-21T13:30:00.000Z' }), AHORA)).toBeNull();
    expect(validarPosicion(entrante({ fechaHora: '2026-10-01T00:00:00.000Z' }), AHORA)).toBeNull();
    expect(validarPosicion(null, AHORA)).toBeNull();
  });

  it('deja en null los datos opcionales fuera de rango', () => {
    expect(validarPosicion(entrante({ velocidad: -1, bateria: 150, rumbo: 'norte' }), AHORA)).toEqual(
      expect.objectContaining({ velocidad: null, bateria: null, rumbo: null }),
    );
  });
});

describe('RegistrarPosicionesUseCase', () => {
  it('guarda las válidas, descarta las inválidas y publica las guardadas', async () => {
    const { trackingRepo, publicador, registrar } = crear();
    const resultado = await registrar.execute([entrante(), entrante({ imei: 'x' })], AHORA);

    expect(resultado).toEqual({ recibidas: 2, guardadas: 1, descartadas: 1 });
    expect(trackingRepo.guardar).toHaveBeenCalledWith([expect.objectContaining({ imei: '900000000000012' })]);
    expect(publicador.publicar).toHaveBeenCalledWith([expect.objectContaining({ idMaquina: 12 })]);
  });

  it('no publica si no se guardó nada', async () => {
    const { trackingRepo, publicador, registrar } = crear();
    trackingRepo.guardar.mockResolvedValueOnce([]);
    await expect(registrar.execute([entrante()], AHORA)).resolves.toEqual({ recibidas: 1, guardadas: 0, descartadas: 1 });
    expect(publicador.publicar).not.toHaveBeenCalled();
  });

  it('rechaza un cuerpo que no es una lista o es demasiado grande', async () => {
    const { registrar } = crear();
    await expect(registrar.execute(undefined, AHORA)).rejects.toThrow();
    await expect(registrar.execute([], AHORA)).rejects.toThrow();
    await expect(registrar.execute(Array.from({ length: 501 }, () => entrante()), AHORA)).rejects.toThrow();
  });
});
