export const MAQUINA_REPOSITORY = Symbol('MAQUINA_REPOSITORY');

export interface MaquinaResumen {
  idMaquina: number;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  tipoMaquina: string | null;
  estado: string | null;
}

// Catálogo del operador: con el operador asignado, para preseleccionar su máquina al iniciar turno
export interface MaquinaCatalogo extends MaquinaResumen {
  idOperadorAsignado: number | null;
}

export interface OperadorAsignado {
  idOperador: number;
  nombre: string;
}

// Operador que el jefe de turno puede asignar a una máquina (tiene usuario OPERADOR activo)
export interface OperadorAsignable extends OperadorAsignado {
  rut: string;
  maquinaAsignada: { idMaquina: number; nombre: string } | null;
}

// Máquina vista por el jefe de turno: incluye las dadas de baja y quién la opera ahora
export interface MaquinaFlota extends MaquinaResumen {
  patente: string | null;
  anio: number | null;
  numeroChasis: string | null;
  esContratista: boolean;
  operadorAsignado: OperadorAsignado | null; // a cargo de la máquina (ASIGNACION_OPERADOR vigente)
  operadorActual: string | null; // operador con turno EN_CURSO en la máquina
  ubicacionActual: string | null; // zona (o área) vigente de ese turno
  horometroActual: number | null; // último horómetro registrado en un turno
}

export interface NuevaMaquina {
  nombre: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  tipoMaquina: string | null;
  patente: string | null;
  numeroChasis: string | null;
  horometroInicial: number;
  esContratista: boolean;
  idOperador: number | null; // operador asignado (opcional)
}

// Quién y por qué: cada acción del jefe de turno sobre la flota queda en BITACORA_JEFE_TURNO
export interface RegistroBitacora {
  idUsuario: number;
  motivo: string;
  observacion: string | null;
}

export type EstadoMaquina = 'ACTIVA' | 'BAJA';

// Datos de la ficha que el jefe de turno puede editar (el horómetro sale de los turnos)
export interface FichaMaquina {
  nombre: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  tipoMaquina: string | null;
  patente: string | null;
  numeroChasis: string | null;
  esContratista: boolean;
  idOperador: number | null; // operador asignado
  estado: EstadoMaquina;
}

export interface AccionBitacora extends RegistroBitacora {
  accion: 'EDITAR' | 'HABILITAR' | 'DESHABILITAR';
  detalle: Record<string, unknown> | null;
  // Otra máquina afectada (p. ej. la que pierde a su operador al reasignarlo); por defecto, la que se guarda
  idMaquina?: number;
}

export interface MaquinaRepositoryPort {
  findById(idMaquina: number): Promise<MaquinaResumen | null>;
  findActivas(): Promise<MaquinaCatalogo[]>;
  // busqueda: texto ya normalizado; coincide con nombre, marca, modelo o tipo
  findFlota(busqueda: string | null): Promise<MaquinaFlota[]>;
  findFlotaById(idMaquina: number): Promise<MaquinaFlota | null>;
  // Comparación sin distinguir mayúsculas, igual que los índices únicos. exceptoId: la máquina que se edita
  existeNombre(nombre: string, exceptoId?: number): Promise<boolean>;
  existePatente(patente: string, exceptoId?: number): Promise<boolean>;
  tieneTurnoEnCurso(idMaquina: number): Promise<boolean>;
  // Los cambios y sus registros en la bitácora se guardan en una misma transacción
  actualizar(idMaquina: number, cambios: Partial<FichaMaquina>, acciones: AccionBitacora[]): Promise<void>;
  // La máquina, su operador y los registros en la bitácora se guardan en una misma transacción.
  // Asignar un operador cierra su asignación anterior (otra máquina); acciones: registros extra en la bitácora
  create(datos: NuevaMaquina, registro: RegistroBitacora, acciones?: AccionBitacora[]): Promise<MaquinaFlota>;
  findOperadoresAsignables(): Promise<OperadorAsignable[]>;
  findOperadorAsignable(idOperador: number): Promise<OperadorAsignable | null>;
  // Tipos de máquina en uso: los de la flota y los del catálogo de modelos activos, sin repetir
  findTipos(): Promise<string[]>;
  // Marcas en uso, con el mismo criterio que findTipos
  findMarcas(): Promise<string[]>;
}
