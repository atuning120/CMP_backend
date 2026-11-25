export const FIRMADOR_DASHBOARD = Symbol('FIRMADOR_DASHBOARD');

// Operación: datos de la app en vivo. Estado de pago: solo el Excel del EP. Comparación: el Excel del EP contra la app.
// Los dos últimos, filtrados por la carga elegida
export const TIPOS_DASHBOARD = ['OPERACION', 'ESTADO_PAGO', 'COMPARACION'] as const;
export type TipoDashboard = (typeof TIPOS_DASHBOARD)[number];

export interface DashboardEmbebido {
  url: string; // para el <iframe>
  expiraEn: Date;
}

// Firma la URL de un dashboard de Metabase (static embedding): quien la abre no necesita cuenta en Metabase.
// `parametros` son los filtros bloqueados del dashboard, que el usuario no puede cambiar
export interface FirmadorDashboardPort {
  // null si Metabase o ese dashboard no están configurados
  firmar(tipo: TipoDashboard, parametros: Record<string, string | number>, ahora: Date): DashboardEmbebido | null;
  // false si Metabase no responde sano (está arrancando o caído): el iframe mostraría el error del proxy de Azure
  disponible(): Promise<boolean>;
}
