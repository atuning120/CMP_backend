import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { CerrarTurnosExcedidosUseCase } from '../../application/use-cases/cerrar-turnos-excedidos.use-case';

const INTERVALO_REVISION_MS = 5 * 60 * 1000;

// Revisa periódicamente los turnos abiertos y cierra los que superaron las 12 horas.
// Los endpoints de turnos también aplican esta regla al consultarlos, así que el intervalo
// solo define cuánto tarda en reflejarse para quien no está usando la app (p. ej. el jefe de turno).
@Injectable()
export class CierreAutomaticoTurnosScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CierreAutomaticoTurnosScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly cerrarTurnosExcedidosUseCase: CerrarTurnosExcedidosUseCase) {}

  onApplicationBootstrap() {
    void this.revisar();
    this.timer = setInterval(() => void this.revisar(), INTERVALO_REVISION_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async revisar() {
    try {
      const cerrados = await this.cerrarTurnosExcedidosUseCase.execute();
      if (cerrados.length > 0) {
        this.logger.warn(`Turnos cerrados automáticamente por superar 12 h: ${cerrados.map((t) => t.id).join(', ')}`);
      }
    } catch (error) {
      this.logger.error('Error al cerrar turnos excedidos', error instanceof Error ? error.stack : String(error));
    }
  }
}
