import type { TrackingRepositoryPort } from '../../domain/repositories/tracking.repository.port';
import type { PuntoRecorrido } from '../../domain/entities/posicion-gps';
import { MAXIMO_PUNTOS, ObtenerRecorridoUseCase } from './obtener-recorrido.use-case';

const AHORA = new Date('2026-11-12T15:00:00Z');
const punto = (minuto: number): PuntoRecorrido => ({
  fechaHora: new Date(Date.parse('2026-11-12T08:00:00Z') + minuto * 60_000),
  latitud: -28.5,
  longitud: -70.8,
  velocidad: 12,
});

const crear = (puntos: PuntoRecorrido[] = [punto(0), punto(1)], turno: Awaited<ReturnType<TrackingRepositoryPort['periodoDeTurno']>> = null) => {
  const repo = {
    recorrido: jest.fn().mockResolvedValue(puntos),
    periodoDeTurno: jest.fn().mockResolvedValue(turno),
  };
  return { useCase: new ObtenerRecorridoUseCase(repo as unknown as TrackingRepositoryPort), repo };
};

const codigoDe = async (promesa: Promise<unknown>) =>
  promesa.then(
    () => null,
    (e: { getResponse: () => { code: string } }) => e.getResponse().code,
  );

describe('ObtenerRecorridoUseCase', () => {
  describe('por máquina', () => {
    it('sin hasta, lee hasta ahora (con margen para relojes adelantados) y lo informa como abierto', async () => {
      const { useCase, repo } = crear();
      const recorrido = await useCase.porMaquina(7, '2026-11-12T03:00:00Z', undefined, AHORA);
      const [idMaquina, desde, tope, limite] = repo.recorrido.mock.calls[0] as [number, Date, Date, number];
      expect(idMaquina).toBe(7);
      expect(desde).toEqual(new Date('2026-11-12T03:00:00Z'));
      expect(tope.getTime()).toBeGreaterThan(AHORA.getTime());
      expect(limite).toBe(MAXIMO_PUNTOS + 1);
      expect(recorrido).toMatchObject({ idMaquina: 7, hasta: null, truncado: false });
      expect(recorrido.puntos).toHaveLength(2);
    });

    it('con hasta, lee el rango cerrado', async () => {
      const { useCase, repo } = crear();
      const recorrido = await useCase.porMaquina(7, '2026-11-11T03:00:00Z', '2026-11-12T03:00:00Z', AHORA);
      expect(repo.recorrido.mock.calls[0][2]).toEqual(new Date('2026-11-12T03:00:00Z'));
      expect(recorrido.hasta).toEqual(new Date('2026-11-12T03:00:00Z'));
    });

    it.each([
      ['sin desde', undefined, undefined],
      ['desde inválido', 'ayer', undefined],
      ['hasta inválido', '2026-11-12T03:00:00Z', 'mañana'],
      ['hasta antes de desde', '2026-11-12T03:00:00Z', '2026-11-12T02:00:00Z'],
      ['más de 48 h', '2026-11-09T03:00:00Z', '2026-11-12T03:00:00Z'],
      ['desde en el futuro', '2026-11-12T16:00:00Z', undefined],
    ])('rechaza %s con 400 RANGO_INVALIDO', async (_caso, desde, hasta) => {
      const { useCase, repo } = crear();
      await expect(codigoDe(useCase.porMaquina(7, desde, hasta, AHORA))).resolves.toBe('RANGO_INVALIDO');
      expect(repo.recorrido).not.toHaveBeenCalled();
    });

    it('avisa si quedaron puntos afuera del tope', async () => {
      const muchos = Array.from({ length: MAXIMO_PUNTOS + 1 }, (_, i) => punto(i / 10));
      const { useCase } = crear(muchos);
      const recorrido = await useCase.porMaquina(7, '2026-11-12T03:00:00Z', undefined, AHORA);
      expect(recorrido.truncado).toBe(true);
      expect(recorrido.puntos).toHaveLength(MAXIMO_PUNTOS);
    });
  });

  describe('por turno', () => {
    it('un turno en curso va desde su inicio hasta ahora', async () => {
      const inicio = new Date('2026-11-12T08:00:00Z');
      const { useCase, repo } = crear(undefined, { idMaquina: 3, inicio, fin: null });
      const recorrido = await useCase.porTurno(40, AHORA);
      expect(repo.recorrido.mock.calls[0][0]).toBe(3);
      expect(repo.recorrido.mock.calls[0][1]).toEqual(inicio);
      expect(recorrido).toMatchObject({ idMaquina: 3, desde: inicio, hasta: null });
    });

    it('un turno cerrado va hasta su término', async () => {
      const fin = new Date('2026-11-12T14:00:00Z');
      const { useCase, repo } = crear(undefined, { idMaquina: 3, inicio: new Date('2026-11-12T08:00:00Z'), fin });
      const recorrido = await useCase.porTurno(40, AHORA);
      expect(repo.recorrido.mock.calls[0][2]).toEqual(fin);
      expect(recorrido.hasta).toEqual(fin);
    });

    it('un turno que no existe responde 404 TURNO_NO_ENCONTRADO', async () => {
      const { useCase } = crear();
      await expect(codigoDe(useCase.porTurno(999, AHORA))).resolves.toBe('TURNO_NO_ENCONTRADO');
    });
  });
});
