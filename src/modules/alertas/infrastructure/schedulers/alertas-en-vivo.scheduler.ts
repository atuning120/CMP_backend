import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DetectarAlertasNuevasUseCase } from '../../application/use-cases/detectar-alertas-nuevas.use-case';
import { PUBLICADOR_ALERTAS } from '../../application/ports/publicador-alertas.port';
import type { PublicadorAlertasPort } from '../../application/ports/publicador-alertas.port';

const INTERVALO_REVISION_MS = 60 * 1000;

// Cada minuto busca alertas de turno nuevas y las publica por WebSocket. Los cierres automáticos aparecen cuando
// CierreAutomaticoTurnosScheduler cierra el turno (cada 5 min), así que pueden tardar hasta 6 min en llegar al panel
@Injectable()
export class AlertasEnVivoScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AlertasEnVivoScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private revisando = false;

  constructor(
    private readonly detectarAlertasNuevasUseCase: DetectarAlertasNuevasUseCase,
    @Inject(PUBLICADOR_ALERTAS)
    private readonly publicador: PublicadorAlertasPort,
  ) {}

  onApplicationBootstrap() {
    void this.revisar();
    this.timer = setInterval(() => void this.revisar(), INTERVALO_REVISION_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async revisar() {
    // Una consulta lenta no debe solaparse con la siguiente: las dos compararían contra el mismo estado
    if (this.revisando) return;
    this.revisando = true;
    try {
      const novedad = await this.detectarAlertasNuevasUseCase.execute();
      if (novedad) this.publicador.publicar(novedad);
    } catch (error) {
      this.logger.error('Error al buscar alertas nuevas', error instanceof Error ? error.stack : String(error));
    } finally {
      this.revisando = false;
    }
  }
}
