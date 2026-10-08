import type { Logger } from '@nestjs/common';
import type { AccionBitacora, MaquinaRepositoryPort, OperadorAsignable, RegistroBitacora } from '../domain/repositories/maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../domain/repositories/modelo-maquina.repository.port';
import { maquinaError } from './maquina.errors';

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
