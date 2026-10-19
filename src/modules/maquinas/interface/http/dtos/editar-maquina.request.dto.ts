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
}
