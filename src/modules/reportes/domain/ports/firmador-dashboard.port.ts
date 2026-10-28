export const FIRMADOR_DASHBOARD = Symbol('FIRMADOR_DASHBOARD');

// Operación: datos de la app en vivo. Estado de pago: Excel del EP contra la app, filtrado por la carga elegida
export type TipoDashboard = 'OPERACION' | 'ESTADO_PAGO';

export interface DashboardEmbebido {
  url: string; // para el <iframe>
  expiraEn: Date;
}

// Firma la URL de un dashboard de Metabase (static embedding): quien la abre no necesita cuenta en Metabase.
// `parametros` son los filtros bloqueados del dashboard, que el usuario no puede cambiar
export interface FirmadorDashboardPort {
  // null si Metabase o ese dashboard no están configurados
  firmar(tipo: TipoDashboard, parametros: Record<string, string | number>, ahora: Date): DashboardEmbebido | null;
}
