// Campos ausentes no se modifican; null o '' borran un campo opcional
export class EditarMaquinaRequestDto {
  nombre?: string;
  marca?: string | null;
  modelo?: string | null;
  anio?: number | null;
  tipoMaquina?: string | null;
  patente?: string | null;
  numeroChasis?: string | null;
  esContratista?: boolean;
  idOperador?: number | null; // null deja la máquina sin operador
  estado?: 'ACTIVA' | 'BAJO_OBSERVACION' | 'EN_MANTENIMIENTO' | 'EN_RESERVA' | 'BAJA';
  regresoEstimado?: string | null; // ISO; solo en mantenimiento o fuera de servicio
  motivo: string;
  observacion?: string | null;
  versionBase?: number; // versión de la máquina que vio el jefe de turno; si cambió, responde 409 MAQUINA_MODIFICADA
  // Lo que veía en cada campo que cambia: con versionBase vieja se aplica igual si nadie tocó esos campos.
  // maquinaOperador: la máquina en que vio al operador que asigna (null = sin máquina)
  valoresBase?: Record<string, unknown> & { maquinaOperador?: number | null };
  idCliente?: string; // UUID generado por el cliente: un reintento de una edición ya guardada no la repite
}
