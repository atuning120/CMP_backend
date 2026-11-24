export const GPS_REPOSITORY = Symbol('GPS_REPOSITORY');

// Modelo del GPS virtual de la app móvil (TrackingPostgresqlRepository): no es un equipo que se administre
export const MODELO_APP_MOVIL = 'APP_MOVIL';

// Un GPS real (p. ej. Jimi LL301) con la máquina en que está instalado hoy
export interface DispositivoGps {
  idGps: number;
  imei: string;
  modelo: string | null;
  numeroSim: string | null;
  activo: boolean;
  maquina: { idMaquina: number; nombre: string } | null;
  asignadoDesde: Date | null;
  ultimaPosicion: { fechaHora: Date; bateria: number | null } | null;
}

export interface AsignacionGps {
  idAsignacion: number;
  maquina: { idMaquina: number; nombre: string };
  desde: Date;
  hasta: Date | null; // null = vigente
}

export interface NuevoGps {
  imei: string;
  modelo: string | null;
  numeroSim: string | null;
}

// undefined = no se toca
export interface CambiosGps {
  modelo?: string | null;
  numeroSim?: string | null;
  activo?: boolean;
}

// Cada máquina que gana o pierde el GPS queda en su bitácora
export interface AccionGps {
  idMaquina: number;
  idUsuario: number;
  motivo: string;
  observacion: string;
  detalle: { antes: { gps: string | null }; despues: { gps: string | null } };
}

export interface CambioAsignacion {
  idGps: number;
  idMaquina: number | null; // null = desvincular
  // Lo que se validó: si al guardar ya no es así (otro jefe de turno lo cambió), no se aplica
  idMaquinaActual: number | null;
  idGpsDesplazado: number | null;
  acciones: AccionGps[];
}

// El GPS o la máquina de destino cambiaron entre la validación y el guardado
export class GpsModificadoError extends Error {}

// Otro GPS ya tiene ese IMEI
export class ImeiDuplicadoError extends Error {}

export interface GpsRepositoryPort {
  listar(): Promise<DispositivoGps[]>;
  buscar(idGps: number): Promise<DispositivoGps | null>;
  deMaquina(idMaquina: number): Promise<DispositivoGps | null>;
  nombreMaquina(idMaquina: number): Promise<string | null>;
  historial(idGps: number): Promise<AsignacionGps[]>;
  // Lanza ImeiDuplicadoError
  crear(datos: NuevoGps): Promise<number>;
  // Lanza GpsModificadoError si se da de baja un GPS que está en una máquina
  editar(idGps: number, cambios: CambiosGps): Promise<void>;
  // Cierra la asignación vigente del GPS y la de otro GPS real en el destino, y abre la nueva. Lanza GpsModificadoError
  cambiarAsignacion(cambio: CambioAsignacion): Promise<void>;
}
