import { useAzureMonitor } from '@azure/monitor-opentelemetry';
import { atributosDelServicio, opcionesAzureMonitor } from './shared/infrastructure/observabilidad/opciones-azure-monitor';

// Primer import de main.ts: OpenTelemetry solo instrumenta los módulos que se cargan después de useAzureMonitor
const opciones = opcionesAzureMonitor(process.env);
if (opciones) {
  Object.assign(process.env, atributosDelServicio(process.env));
  useAzureMonitor(opciones);
}
