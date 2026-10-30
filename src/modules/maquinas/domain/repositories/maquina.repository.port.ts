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
  // Último horómetro final registrado en un turno: la app no acepta un horómetro inicial menor
  horometroUltimo: number | null;
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
  // Solo si no está ACTIVA: el último cambio de estado (o reemplazo) de la bitácora, con su motivo
  motivoEstado: { motivo: string; observacion: string | null; fecha: Date; reemplazadaPor: string | null } | null;
  operadorActual: string | null; // operador con turno EN_CURSO en la máquina
  // Ese turno: el jefe de turno lo cierra por su id (sin señal, otro pudo empezar después en la máquina)
  idTurnoActual: number | null;
  // Estado operacional vigente de ese turno (PRODUCTIVO, DEMORA, MANTENCION); null si aún no registra ninguno
  estadoOperacional: { idEstado: number; nombre: string; categoria: string | null; desde: Date } | null;
  ubicacionActual: string | null; // zona (o área) vigente de ese turno
  // Ids de esa ubicación, para situar la máquina en el mapa de geocercas (no hay GPS en línea)
  idAreaActual: number | null;
  idZonaActual: number | null;
  horometroActual: number | null; // último horómetro registrado en un turno
  // En mantenimiento o fuera de servicio: cuándo se espera que vuelva a operar (lo informa el jefe de turno)
  regresoEstimado: Date | null;
  // Máquina que la cubre mientras no opera (tras un reemplazo). estadoAlDevolver: a qué estado vuelve el respaldo
  respaldo: { idMaquina: number; nombre: string; estadoAlDevolver: EstadoMaquina } | null;
  // Si esta máquina es el respaldo de otra: la original a la que cubre
  cubreA: { idMaquina: number; nombre: string } | null;
  // Sube con cada acción del jefe de turno; el cliente la devuelve como versionBase al modificarla
  version: number;
  // Última acción sobre la máquina: cuándo y quién (nombre del usuario)
  actualizadoEn: Date | null;
  actualizadoPor: string | null;
}

// Versión con que se validó una acción: si la máquina cambió antes de guardar, la acción no se aplica
export interface VersionEsperada {
  idMaquina: number;
  version: number;
}

// Otra acción sobre la máquina se guardó entre la validación y el guardado (la transacción se revierte)
export class MaquinaModificadaError extends Error {
  constructor(public readonly idMaquina: number) {
    super(`La máquina ${idMaquina} cambió antes de guardar`);
  }
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
  idCliente?: string | null; // UUID del cliente que la incorpora (hace idempotente el reintento)
}

// Quién y por qué: cada acción del jefe de turno sobre la flota queda en BITACORA_JEFE_TURNO
export interface RegistroBitacora {
  idUsuario: number;
  motivo: string;
  observacion: string | null;
}

// ACTIVA = Operativo; BAJA = Fuera de servicio (no puede iniciar turno; es la única que se puede reemplazar).
// "Sin operador" no es un estado: se deduce de que la máquina no tenga operador asignado
export const ESTADOS_MAQUINA = ['ACTIVA', 'BAJO_OBSERVACION', 'EN_MANTENIMIENTO', 'EN_RESERVA', 'BAJA'] as const;
export type EstadoMaquina = (typeof ESTADOS_MAQUINA)[number];
export const esEstadoMaquina = (valor: unknown): valor is EstadoMaquina => ESTADOS_MAQUINA.includes(valor as EstadoMaquina);

// Estados en que la máquina no trabaja: no se puede iniciar turno en ella (sin conexión se acepta como conflicto)
// ni pasarla a ellos con un turno en curso. "Bajo observación" sí opera, vigilada
export const ESTADOS_SIN_OPERAR: readonly EstadoMaquina[] = ['EN_MANTENIMIENTO', 'EN_RESERVA', 'BAJA'];
export const operaEnEstado = (estado: string | null) => !ESTADOS_SIN_OPERAR.includes(estado as EstadoMaquina);
// Estados con fecha estimada de regreso (una reparación de 40 h, una falla mayor)
export const ESTADOS_CON_REGRESO: readonly EstadoMaquina[] = ['EN_MANTENIMIENTO', 'BAJA'];
// Estado de la máquina que sale en un reemplazo
export type EstadoSaliente = 'EN_MANTENIMIENTO' | 'BAJA';

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
  // HABILITAR: sale de BAJA; DESHABILITAR: pasa a BAJA; CAMBIAR_ESTADO: entre estados que no son BAJA
  // DEVOLVER: la original vuelve a operar y su respaldo vuelve al estado que tenía antes del reemplazo
  accion: 'INCORPORAR' | 'EDITAR' | 'HABILITAR' | 'DESHABILITAR' | 'CAMBIAR_ESTADO' | 'REEMPLAZAR' | 'DEVOLVER';
  detalle: Record<string, unknown> | null;
  // Otra máquina afectada (p. ej. la que pierde a su operador al reasignarlo); por defecto, la que se guarda
  idMaquina?: number;
  // UUID del cliente que hizo la acción (solo en la primera fila que deja): hace idempotente el reintento
  idCliente?: string | null;
}

// Reemplazo: la saliente queda en mantenimiento o fuera de servicio y la entrante (de la flota o nueva) toma su
// lugar. La saliente recuerda a su respaldo para poder devolver todo como estaba cuando vuelva
export interface ReemplazoMaquina {
  idSaliente: number;
  estadoSaliente: EstadoSaliente;
  regresoEstimado: Date | null;
  // Estado del respaldo antes de entrar (al devolver vuelve a él); una máquina nueva queda en reserva
  estadoPrevioEntrante: EstadoMaquina;
  // De la flota (habilitar: estaba fuera de servicio) o una máquina nueva que se crea
  entrante: { idMaquina: number; habilitar: boolean } | { nueva: Omit<NuevaMaquina, 'idOperador'> };
  idOperador: number | null; // operador a cargo de la entrante al terminar
  versiones: VersionEsperada[]; // la saliente y, si es de la flota, la entrante
  accionesSaliente: AccionBitacora[];
  accionesEntrante: AccionBitacora[]; // se registran con el id de la entrante (que aún no existe si es nueva)
  accionesOtras: AccionBitacora[]; // con idMaquina explícito (p. ej. la máquina de donde viene el operador)
}

// Devolución: deshace un reemplazo cuando la original vuelve a operar
export interface DevolucionMaquina {
  idOriginal: number;
  idRespaldo: number;
  estadoRespaldo: EstadoMaquina; // al que vuelve el respaldo
  idOperador: number | null; // el operador del respaldo vuelve a la original
  versiones: VersionEsperada[]; // la original y su respaldo
  accionesOriginal: AccionBitacora[];
  accionesRespaldo: AccionBitacora[];
}

// Cambios de una edición; regresoEstimado no es parte de la ficha (acompaña al estado)
export type CambiosMaquina = Partial<FichaMaquina> & { regresoEstimado?: Date | null };

export interface MaquinaRepositoryPort {
  findById(idMaquina: number): Promise<MaquinaResumen | null>;
  findActivas(): Promise<MaquinaCatalogo[]>;
  // busqueda: texto ya normalizado; coincide con nombre, marca, modelo o tipo
  findFlota(busqueda: string | null): Promise<MaquinaFlota[]>;
  findFlotaById(idMaquina: number): Promise<MaquinaFlota | null>;
  // La máquina incorporada con ese UUID del cliente, si ya existe
  findIdPorIdCliente(idCliente: string): Promise<number | null>;
  // Si ya se guardó una acción del jefe de turno con ese UUID del cliente
  existeAccionDeCliente(idCliente: string): Promise<boolean>;
  // Comparación sin distinguir mayúsculas, igual que los índices únicos. exceptoId: la máquina que se edita
  existeNombre(nombre: string, exceptoId?: number): Promise<boolean>;
  existePatente(patente: string, exceptoId?: number): Promise<boolean>;
  tieneTurnoEnCurso(idMaquina: number): Promise<boolean>;
  // Los cambios y sus registros en la bitácora se guardan en una misma transacción
  // Al pasar a un estado sin regreso (operativo, en reserva) se borra el regreso estimado
  // Toda acción que se guarda sube la versión de las máquinas que toca (también la que pierde a su operador).
  // Si una máquina validada (version) ya cambió, lanza MaquinaModificadaError sin guardar nada
  actualizar(idMaquina: number, version: number, cambios: CambiosMaquina, acciones: AccionBitacora[]): Promise<void>;
  // La máquina, su operador y los registros en la bitácora se guardan en una misma transacción.
  // Asignar un operador cierra su asignación anterior (otra máquina); acciones: registros extra en la bitácora
  create(datos: NuevaMaquina, registro: RegistroBitacora, acciones?: AccionBitacora[]): Promise<MaquinaFlota>;
  findOperadoresAsignables(): Promise<OperadorAsignable[]>;
  // Todo el reemplazo en una transacción; devuelve el id de la entrante
  reemplazar(reemplazo: ReemplazoMaquina): Promise<number>;
  // Toda la devolución en una transacción
  devolver(devolucion: DevolucionMaquina): Promise<void>;
  findOperadorAsignable(idOperador: number): Promise<OperadorAsignable | null>;
  // Tipos de máquina en uso: los de la flota y los del catálogo de modelos activos, sin repetir
  findTipos(): Promise<string[]>;
  // Marcas en uso, con el mismo criterio que findTipos
  findMarcas(): Promise<string[]>;
}
