import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTO_TURNOS_CAMBIARON } from '../../../../shared/application/eventos-turnos';
import { DetectarAlertasNuevasUseCase } from '../../application/use-cases/detectar-alertas-nuevas.use-case';
import { PUBLICADOR_ALERTAS } from '../../application/ports/publicador-alertas.port';
import type { PublicadorAlertasPort } from '../../application/ports/publicador-alertas.port';

// Lo que depende solo del reloj (un turno que cruza las 10 h) se detecta en la revisión periódica: llega en <= 15 s
const INTERVALO_REVISION_MS = 15 * 1000;
// Varios cambios seguidos (p. ej. la cola sin conexión de la app al recuperar señal) se juntan en una revisión
const ESPERA_TRAS_CAMBIO_MS = 300;

/**
 * Busca alertas de turno nuevas y las publica por WebSocket. Revisa al instante cuando se guarda un cambio de turno
 * (evento EVENTO_TURNOS_CAMBIARON: mantención o falla, cierre automático, inicio o fin) y además cada 15 s, para los
 * turnos que cruzan las 10 h sin que nada cambie. Cada réplica revisa por su cuenta y avisa a sus conexiones.
 */
@Injectable()
export class AlertasEnVivoScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AlertasEnVivoScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private esperaCambio: NodeJS.Timeout | null = null;
  private revisando = false;
  // Llegó un cambio durante una revisión: al terminar se revisa otra vez para no perderlo
  private revisarDeNuevo = false;

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
    if (this.esperaCambio) clearTimeout(this.esperaCambio);
  }

  @OnEvent(EVENTO_TURNOS_CAMBIARON)
  alCambiarTurnos() {
    if (this.esperaCambio) return;
    this.esperaCambio = setTimeout(() => {
      this.esperaCambio = null;
      void this.revisar();
    }, ESPERA_TRAS_CAMBIO_MS);
  }

  private async revisar() {
    // Una consulta lenta no debe solaparse con la siguiente: las dos compararían contra el mismo estado
    if (this.revisando) {
      this.revisarDeNuevo = true;
      return;
    }
    this.revisando = true;
    try {
      const novedad = await this.detectarAlertasNuevasUseCase.execute();
      if (novedad) this.publicador.publicar(novedad);
    } catch (error) {
      this.logger.error('Error al buscar alertas nuevas', error instanceof Error ? error.stack : String(error));
    } finally {
      this.revisando = false;
    }
    if (this.revisarDeNuevo) {
      this.revisarDeNuevo = false;
      void this.revisar();
    }
  }
}
