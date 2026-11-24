import type { TrackingRepositoryPort } from '../../domain/repositories/tracking.repository.port';
import { ObtenerUltimasPosicionesUseCase } from './obtener-ultimas-posiciones.use-case';

describe('ObtenerUltimasPosicionesUseCase', () => {
  it('pide las últimas 13 h, y 7 días para los GPS reales', async () => {
    const ultimasPorMaquina = jest.fn(async () => []);
    const useCase = new ObtenerUltimasPosicionesUseCase({ ultimasPorMaquina } as unknown as TrackingRepositoryPort);
    await useCase.execute(new Date('2026-11-24T13:00:00Z'));
    expect(ultimasPorMaquina).toHaveBeenCalledWith(new Date('2026-11-24T00:00:00Z'), new Date('2026-11-17T13:00:00Z'));
  });
});
