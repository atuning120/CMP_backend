import type { Logger } from '@nestjs/common';
import { MaquinaModificadaError } from '../domain/repositories/maquina.repository.port';
import type {
  AccionBitacora,
  MaquinaFlota,
  MaquinaRepositoryPort,
  NuevaMaquina,
  OperadorAsignable,
  RegistroBitacora,
} from '../domain/repositories/maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../domain/repositories/modelo-maquina.repository.port';
import { maquinaError } from './maquina.errors';
import { accionVencida } from '../../../shared/application/vigencia-accion';

// Validación y normalización compartidas por la incorporación y la edición de máquinas

export const ROLES_GESTION_FLOTA = ['JEFE_TURNO', 'ADMIN'];

// Largos máximos de las columnas en MAQUINA y BITACORA_JEFE_TURNO (observacion es TEXT; el límite evita abusos)
const LARGOS = { nombre: 100, marca: 50, modelo: 50, tipoMaquina: 50, patente: 15, numeroChasis: 50, motivo: 100, observacion: 500 } as const;
type CampoTexto = keyof typeof LARGOS;

const ETIQUETAS: Record<CampoTexto, string> = {
  nombre: 'código interno',
  marca: 'marca',
  modelo: 'modelo',
  tipoMaquina: 'tipo de máquina',
  patente: 'patente',
  numeroChasis: 'N° de chasis',
  motivo: 'motivo',
  observacion: 'observación',
};

export const texto = (campo: CampoTexto, valor: unknown): string | null => {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw maquinaError('DATOS_INVALIDOS', `El campo ${ETIQUETAS[campo]} no es válido`);
  const limpio = valor.trim();
  if (limpio.length > LARGOS[campo]) {
    throw maquinaError('DATOS_INVALIDOS', `El campo ${ETIQUETAS[campo]} admite hasta ${LARGOS[campo]} caracteres`);
  }
  return limpio === '' ? null : limpio;
};

// Código y patente se guardan en mayúsculas, como se rotulan en faena
export const textoMayusculas = (campo: 'nombre' | 'patente', valor: unknown) => texto(campo, valor)?.toUpperCase() ?? null;

export const leerAnio = (valor: unknown): number | null => {
  if (valor === undefined || valor === null || valor === '') return null;
  const anio = Number(valor);
  if (!Number.isInteger(anio) || anio < 1950 || anio > new Date().getFullYear() + 1) throw maquinaError('ANIO_INVALIDO');
  return anio;
};

export interface MarcaYTipo {
  marca: string | null;
  tipoMaquina: string | null;
  // Alguno de los dos no existía: conviene registrar el modelo en el catálogo
  hayNuevo: boolean;
}

// Marca y tipo que ya existen con otras mayúsculas se guardan con la escritura existente, para no duplicarlos
export const normalizarMarcaYTipo = async (
  maquinaRepo: MaquinaRepositoryPort,
  marcaIngresada: string | null,
  tipoIngresado: string | null,
): Promise<MarcaYTipo> => {
  const buscar = async (valor: string, listar: () => Promise<string[]>) =>
    (await listar()).find((existente) => existente.toUpperCase() === valor.toUpperCase());
  const [marcaExistente, tipoExistente] = await Promise.all([
    marcaIngresada ? buscar(marcaIngresada, () => maquinaRepo.findMarcas()) : undefined,
    tipoIngresado ? buscar(tipoIngresado, () => maquinaRepo.findTipos()) : undefined,
  ]);
  return {
    marca: marcaExistente ?? marcaIngresada,
    tipoMaquina: tipoExistente ?? tipoIngresado,
    hayNuevo: !marcaExistente || !tipoExistente,
  };
};

// Marca o tipo nuevo: queda registrado como modelo para que aparezca en los selectores y en "Datos Previos".
// La máquina ya quedó guardada: no se revierte por no poder registrar el modelo
export const registrarModeloSiEsNuevo = async (
  modeloRepo: ModeloMaquinaRepositoryPort,
  logger: Logger,
  datos: MarcaYTipo & { modelo: string | null },
) => {
  const { marca, modelo, tipoMaquina } = datos;
  if (!marca || !modelo || !tipoMaquina || !datos.hayNuevo) return;
  try {
    await modeloRepo.crearSiNoExiste({ nombre: `${tipoMaquina} ${marca} ${modelo}`.slice(0, 100), marca, modelo, tipoMaquina });
  } catch (error) {
    logger.warn(`No se pudo registrar el modelo "${marca} ${modelo}" (${tipoMaquina}): ${String(error)}`);
  }
};

// Operador a asignar: undefined si no vino (no se toca), null para dejar la máquina sin operador
export const leerOperador = async (maquinaRepo: MaquinaRepositoryPort, valor: unknown): Promise<OperadorAsignable | null | undefined> => {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  const idOperador = Number(valor);
  const operador = Number.isInteger(idOperador) && idOperador > 0 ? await maquinaRepo.findOperadorAsignable(idOperador) : null;
  if (!operador) throw maquinaError('DATOS_INVALIDOS', 'El operador no existe o no tiene acceso como operador');
  return operador;
};

// Si el operador estaba a cargo de otra máquina, esa máquina lo pierde: queda registrado en su bitácora
export const accionesPorReasignacion = (
  operador: OperadorAsignable | null | undefined,
  idMaquinaDestino: number | null,
  codigoDestino: string,
  registro: RegistroBitacora,
): AccionBitacora[] => {
  const anterior = operador?.maquinaAsignada;
  if (!operador || !anterior || anterior.idMaquina === idMaquinaDestino) return [];
  return [
    {
      ...registro,
      idMaquina: anterior.idMaquina,
      accion: 'EDITAR',
      observacion: `${operador.nombre} pasó a ${codigoDestino}`,
      detalle: { antes: { operador: operador.nombre }, despues: { operador: null } },
    },
  ];
};

// Datos de una máquina nueva (al incorporarla o como entrante de un reemplazo), tal como llegan
export interface NuevaMaquinaDto {
  nombre: unknown;
  marca?: unknown;
  modelo?: unknown;
  anio?: unknown;
  tipoMaquina?: unknown;
  patente?: unknown;
  numeroChasis?: unknown;
  horometroInicial: unknown;
  esContratista?: unknown;
}

// Valida y normaliza una máquina nueva: código y patente sin repetir, horómetro y año válidos
export const leerNuevaMaquina = async (
  maquinaRepo: MaquinaRepositoryPort,
  dto: NuevaMaquinaDto,
): Promise<{ datos: Omit<NuevaMaquina, 'idOperador'>; marcaYTipo: MarcaYTipo }> => {
  const nombre = textoMayusculas('nombre', dto.nombre);
  if (!nombre) throw maquinaError('DATOS_INVALIDOS', 'El código interno es obligatorio');
  const patente = textoMayusculas('patente', dto.patente);

  const horometroInicial = Number(dto.horometroInicial);
  if (dto.horometroInicial === null || dto.horometroInicial === '' || !Number.isFinite(horometroInicial) || horometroInicial < 0) {
    throw maquinaError('HOROMETRO_INVALIDO');
  }

  const anio = leerAnio(dto.anio);

  if (await maquinaRepo.existeNombre(nombre)) throw maquinaError('CODIGO_DUPLICADO', nombre);
  if (patente && (await maquinaRepo.existePatente(patente))) throw maquinaError('PATENTE_DUPLICADA', patente);

  const marcaYTipo = await normalizarMarcaYTipo(maquinaRepo, texto('marca', dto.marca), texto('tipoMaquina', dto.tipoMaquina));
  return {
    datos: {
      nombre,
      marca: marcaYTipo.marca,
      modelo: texto('modelo', dto.modelo),
      anio,
      tipoMaquina: marcaYTipo.tipoMaquina,
      patente,
      numeroChasis: texto('numeroChasis', dto.numeroChasis),
      horometroInicial,
      esContratista: dto.esContratista === true,
    },
    marcaYTipo,
  };
};

// Una reparación larga se planifica en días o semanas; más de un año adelante es casi seguro un error de tipeo
const MAXIMO_REGRESO_MS = 366 * 24 * 60 * 60 * 1000;

// Fecha estimada de regreso: undefined = no viene (no cambia); null o '' = se borra
export const leerRegresoEstimado = (valor: unknown, ahora: Date = new Date()): Date | null | undefined => {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  const fecha = typeof valor === 'string' ? new Date(valor) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) throw maquinaError('DATOS_INVALIDOS', 'La fecha estimada de regreso no es válida');
  if (fecha.getTime() <= ahora.getTime()) throw maquinaError('DATOS_INVALIDOS', 'La fecha estimada de regreso debe ser futura');
  if (fecha.getTime() - ahora.getTime() > MAXIMO_REGRESO_MS) {
    throw maquinaError('DATOS_INVALIDOS', 'La fecha estimada de regreso no puede ser en más de un año');
  }
  return fecha;
};

// Varios jefes de turno (en la web y en la app) gestionan la misma flota: una acción preparada sobre una versión
// vieja de la máquina no pisa lo que otro cambió mientras tanto
const maquinaModificada = (maquina: MaquinaFlota) =>
  maquinaError('MAQUINA_MODIFICADA', `${maquina.nombre} fue modificada${maquina.actualizadoPor ? ` por ${maquina.actualizadoPor}` : ''}`);

// versionBase: la versión de la máquina que vio el cliente al preparar la acción. Si no viene (versiones anteriores
// de la app o del panel) no se compara
export const versionDesactualizada = (maquina: MaquinaFlota, versionBase: unknown): boolean => {
  if (versionBase === undefined || versionBase === null) return false;
  if (!Number.isInteger(versionBase)) throw maquinaError('DATOS_INVALIDOS', 'La versión de la máquina no es válida');
  return versionBase !== maquina.version;
};

export const verificarVersionBase = (maquina: MaquinaFlota, versionBase: unknown) => {
  if (versionDesactualizada(maquina, versionBase)) throw maquinaModificada(maquina);
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// UUID que genera el cliente para una acción hecha sin señal: se repite en cada reintento (null si no viene)
export const leerIdCliente = (valor: unknown): string | null => {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string' || !UUID_REGEX.test(valor)) {
    throw maquinaError('DATOS_INVALIDOS', 'El identificador de la acción no es válido');
  }
  return valor.toLowerCase();
};

// Desfase tolerado entre el reloj del teléfono y el del servidor
const DESFASE_MAXIMO_MS = 5 * 60 * 1000;

/**
 * fechaAccion: cuándo hizo el jefe de turno la acción, si la hizo sin señal y se envía después. Pasadas 72 h ya no se
 * aplica (la app la descarta antes; esto es el respaldo). undefined o null: la acción es de ahora
 */
export const verificarVigencia = (fechaAccion: unknown, ahora: Date = new Date()) => {
  if (fechaAccion === undefined || fechaAccion === null) return;
  const fecha = typeof fechaAccion === 'string' ? new Date(fechaAccion) : null;
  if (!fecha || Number.isNaN(fecha.getTime()) || fecha.getTime() > ahora.getTime() + DESFASE_MAXIMO_MS) {
    throw maquinaError('DATOS_INVALIDOS', 'La fecha de la acción no es válida');
  }
  if (accionVencida(fecha, ahora)) throw maquinaError('ACCION_VENCIDA');
};

// Otro jefe de turno cambió los mismos campos que este quería cambiar. queCambio: p. ej. "la patente y el año"
export const camposModificados = (maquina: MaquinaFlota, queCambio: string) =>
  maquinaError(
    'MAQUINA_MODIFICADA',
    `${maquina.nombre} fue modificada${maquina.actualizadoPor ? ` por ${maquina.actualizadoPor}` : ''} (cambió ${queCambio})`,
  );

// El jefe de turno eligió al operador viéndolo en una máquina (maquinaBase: su id, o null sin máquina). Si otro jefe de
// turno lo movió mientras tanto, moverlo ahora sorprendería a ese otro: es conflicto. undefined = el cliente no la envía
export const verificarMaquinaDelOperador = (operador: OperadorAsignable | null | undefined, maquinaBase: unknown) => {
  if (!operador || maquinaBase === undefined) return;
  if ((operador.maquinaAsignada?.idMaquina ?? null) === (maquinaBase ?? null)) return;
  const donde = operador.maquinaAsignada ? `asignado a ${operador.maquinaAsignada.nombre}` : 'dejado sin máquina';
  throw maquinaError('MAQUINA_MODIFICADA', `${operador.nombre} fue ${donde}`);
};

// Guarda la acción; si otra se guardó entre la validación y el guardado, se responde igual que a una versionBase vieja
export const guardarSinPisar = async <T>(maquinaRepo: MaquinaRepositoryPort, guardar: () => Promise<T>): Promise<T> => {
  try {
    return await guardar();
  } catch (error) {
    if (!(error instanceof MaquinaModificadaError)) throw error;
    const actual = await maquinaRepo.findFlotaById(error.idMaquina);
    throw actual ? maquinaModificada(actual) : maquinaError('MAQUINA_NO_ENCONTRADA');
  }
};
