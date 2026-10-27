import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ESTADOS_CON_REGRESO,
  esEstadoMaquina,
  MAQUINA_REPOSITORY,
  operaEnEstado,
} from '../../domain/repositories/maquina.repository.port';
import type {
  AccionBitacora,
  CambiosMaquina,
  EstadoMaquina,
  FichaMaquina,
  MaquinaFlota,
  MaquinaRepositoryPort,
  OperadorAsignable,
} from '../../domain/repositories/maquina.repository.port';
import { MODELO_MAQUINA_REPOSITORY } from '../../domain/repositories/modelo-maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { maquinaError } from '../maquina.errors';
import {
  accionesPorReasignacion,
  camposModificados,
  guardarSinPisar,
  leerAnio,
  leerIdCliente,
  leerOperador,
  leerRegresoEstimado,
  normalizarMarcaYTipo,
  registrarModeloSiEsNuevo,
  ROLES_GESTION_FLOTA,
  texto,
  textoMayusculas,
  verificarMaquinaDelOperador,
  verificarVersionBase,
  versionDesactualizada,
} from '../maquina.datos';

// Campos ausentes (undefined) no se modifican; null o '' borran un campo opcional
export interface EditarMaquinaDto {
  rol: string;
  idUsuario?: number;
  idMaquina: unknown;
  nombre?: unknown;
  marca?: unknown;
  modelo?: unknown;
  anio?: unknown;
  tipoMaquina?: unknown;
  patente?: unknown;
  numeroChasis?: unknown;
  esContratista?: unknown;
  idOperador?: unknown; // null deja la máquina sin operador asignado
  estado?: unknown;
  // Solo en mantenimiento o fuera de servicio: ISO; null o '' la borra
  regresoEstimado?: unknown;
  motivo?: unknown;
  observacion?: unknown;
  versionBase?: unknown; // versión de la máquina que vio el jefe de turno al preparar el cambio
  // Lo que veía el jefe de turno en cada campo que cambia (el mismo nombre del campo). Con versionBase vieja, el cambio
  // se aplica igual si nadie tocó esos campos. maquinaOperador: id de la máquina en que vio al operador que asigna (o null)
  valoresBase?: unknown;
  idCliente?: unknown; // UUID generado por el cliente: un reintento de una edición ya guardada no la repite
}

type CampoFicha = Exclude<keyof FichaMaquina, 'estado'>;
const CAMPOS_FICHA: CampoFicha[] = ['nombre', 'marca', 'modelo', 'anio', 'tipoMaquina', 'patente', 'numeroChasis', 'esContratista', 'idOperador'];

// Cómo se nombra cada campo en el mensaje de conflicto
const NOMBRE_CAMPO: Record<CampoFicha, string> = {
  nombre: 'el código',
  marca: 'la marca',
  modelo: 'el modelo',
  anio: 'el año',
  tipoMaquina: 'el tipo',
  patente: 'la patente',
  numeroChasis: 'el chasis',
  esContratista: 'si es contratista',
  idOperador: 'el operador',
};

// Mismo valor sin importar espacios, mayúsculas ni '' vs null (el cliente lo copió de la flota)
const normalizar = (valor: unknown) => {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === 'string') return valor.trim().toUpperCase() || null;
  return valor;
};

const enumerar = (partes: string[]) => (partes.length < 2 ? partes.join('') : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`);

@Injectable()
export class EditarMaquinaUseCase {
  private readonly logger = new Logger(EditarMaquinaUseCase.name);

  constructor(
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
    @Inject(MODELO_MAQUINA_REPOSITORY)
    private readonly modeloRepo: ModeloMaquinaRepositoryPort,
  ) {}

  async execute(dto: EditarMaquinaDto): Promise<MaquinaFlota> {
    if (!ROLES_GESTION_FLOTA.includes(dto.rol) || !dto.idUsuario) throw maquinaError('SIN_PERMISO');

    const idMaquina = Number(dto.idMaquina);
    const actual = Number.isInteger(idMaquina) && idMaquina > 0 ? await this.maquinaRepo.findFlotaById(idMaquina) : null;
    if (!actual) throw maquinaError('MAQUINA_NO_ENCONTRADA');
    const idCliente = leerIdCliente(dto.idCliente);
    // Reintento de una edición ya guardada (la respuesta no llegó): se responde con cómo quedó, sin aplicarla de nuevo
    if (idCliente && (await this.maquinaRepo.existeAccionDeCliente(idCliente))) return actual;
    const desactualizada = versionDesactualizada(actual, dto.versionBase);
    const valoresBase = typeof dto.valoresBase === 'object' && dto.valoresBase !== null ? (dto.valoresBase as Record<string, unknown>) : null;

    // Toda edición queda justificada en la bitácora del jefe de turno
    const motivo = texto('motivo', dto.motivo);
    if (!motivo) throw maquinaError('DATOS_INVALIDOS', 'El motivo de la edición es obligatorio');
    const observacion = texto('observacion', dto.observacion);

    const antes: FichaMaquina = {
      nombre: actual.nombre,
      marca: actual.marca,
      modelo: actual.modelo,
      anio: actual.anio,
      tipoMaquina: actual.tipoMaquina,
      patente: actual.patente,
      numeroChasis: actual.numeroChasis,
      esContratista: actual.esContratista,
      idOperador: actual.operadorAsignado?.idOperador ?? null,
      estado: esEstadoMaquina(actual.estado) ? actual.estado : 'ACTIVA',
    };
    // Otro jefe de turno cambió la máquina mientras este preparaba el cambio
    if (desactualizada) this.combinarConCambiosDeOtro(dto, actual, antes, valoresBase);
    const { ficha: despues, marcaOTipoNuevo, operador } = await this.leerFicha(dto, antes);
    verificarMaquinaDelOperador(operador, valoresBase?.maquinaOperador);

    const cambiados = CAMPOS_FICHA.filter((campo) => despues[campo] !== antes[campo]);
    const cambiaEstado = despues.estado !== antes.estado;

    const regreso = leerRegresoEstimado(dto.regresoEstimado);
    if (regreso && !ESTADOS_CON_REGRESO.includes(despues.estado)) {
      throw maquinaError('DATOS_INVALIDOS', 'Solo una máquina en mantenimiento o fuera de servicio tiene fecha estimada de regreso');
    }
    // Al volver a operar el regreso se borra solo (lo hace el repositorio)
    const regresoAntes = actual.regresoEstimado?.getTime() ?? null;
    const cambiaRegreso = regreso !== undefined && (regreso?.getTime() ?? null) !== regresoAntes && ESTADOS_CON_REGRESO.includes(despues.estado);
    if (cambiados.length === 0 && !cambiaEstado && !cambiaRegreso) throw maquinaError('SIN_CAMBIOS');

    // Al editar se compara sin la propia máquina; cambiar solo mayúsculas no es un duplicado
    if (cambiados.includes('nombre') && (await this.maquinaRepo.existeNombre(despues.nombre, idMaquina))) {
      throw maquinaError('CODIGO_DUPLICADO', despues.nombre);
    }
    if (cambiados.includes('patente') && despues.patente && (await this.maquinaRepo.existePatente(despues.patente, idMaquina))) {
      throw maquinaError('PATENTE_DUPLICADA', despues.patente);
    }
    // Un operador la está usando: sacarla de operación dejaría su turno en una máquina que no trabaja.
    // El jefe de turno primero cierra ese turno (con el horómetro final) y luego cambia el estado
    if (cambiaEstado && !operaEnEstado(despues.estado) && (await this.maquinaRepo.tieneTurnoEnCurso(idMaquina))) {
      throw maquinaError('MAQUINA_EN_USO', antes.nombre);
    }

    const registro = { idUsuario: dto.idUsuario, motivo, observacion };
    const acciones: AccionBitacora[] = [];
    if (cambiados.length > 0) {
      // Solo los campos que cambiaron, con su valor anterior y el nuevo. El operador va por nombre, legible en el historial
      const nombreOperador = { antes: actual.operadorAsignado?.nombre ?? null, despues: operador?.nombre ?? null };
      const valores = (ficha: FichaMaquina, cual: 'antes' | 'despues') =>
        Object.fromEntries(cambiados.map((campo) => (campo === 'idOperador' ? ['operador', nombreOperador[cual]] : [campo, ficha[campo]])));
      acciones.push({ ...registro, accion: 'EDITAR', detalle: { antes: valores(antes, 'antes'), despues: valores(despues, 'despues') } });
      if (cambiados.includes('idOperador')) acciones.push(...accionesPorReasignacion(operador, idMaquina, despues.nombre, registro));
    }
    const regresoNuevo = cambiaRegreso ? (regreso ?? null) : ESTADOS_CON_REGRESO.includes(despues.estado) ? actual.regresoEstimado : null;
    if (cambiaEstado) {
      const accion = despues.estado === 'BAJA' ? 'DESHABILITAR' : antes.estado === 'BAJA' ? 'HABILITAR' : 'CAMBIAR_ESTADO';
      const despuesEstado = { estado: despues.estado, ...(regresoNuevo ? { regresoEstimado: regresoNuevo.toISOString() } : {}) };
      acciones.push({ ...registro, accion, detalle: { antes: { estado: antes.estado }, despues: despuesEstado } });
    } else if (cambiaRegreso) {
      // Se reprogramó el regreso sin cambiar de estado (la reparación se alargó o se adelantó)
      acciones.push({
        ...registro,
        accion: 'EDITAR',
        detalle: {
          antes: { regresoEstimado: actual.regresoEstimado?.toISOString() ?? null },
          despues: { regresoEstimado: regresoNuevo?.toISOString() ?? null },
        },
      });
    }

    const cambios: CambiosMaquina = Object.fromEntries(cambiados.map((campo) => [campo, despues[campo]]));
    if (cambiaEstado) cambios.estado = despues.estado;
    if (cambiaRegreso) cambios.regresoEstimado = regreso ?? null;
    if (idCliente) acciones[0].idCliente = idCliente;
    try {
      await guardarSinPisar(this.maquinaRepo, () => this.maquinaRepo.actualizar(idMaquina, actual.version, cambios, acciones));
    } catch (error) {
      // Dos reintentos simultáneos: el segundo choca con la versión que subió el primero
      if (idCliente && (await this.maquinaRepo.existeAccionDeCliente(idCliente))) return (await this.maquinaRepo.findFlotaById(idMaquina)) ?? actual;
      throw error;
    }

    if (cambiados.some((campo) => campo === 'marca' || campo === 'modelo' || campo === 'tipoMaquina')) {
      await registrarModeloSiEsNuevo(this.modeloRepo, this.logger, {
        marca: despues.marca,
        modelo: despues.modelo,
        tipoMaquina: despues.tipoMaquina,
        hayNuevo: marcaOTipoNuevo,
      });
    }

    // Se vuelve a leer para entregar la nueva versión (la próxima acción del cliente parte de ella)
    return (await this.maquinaRepo.findFlotaById(idMaquina)) ?? actual;
  }

  /**
   * Los campos de la ficha (incluido el operador) se combinan: el cambio se aplica si nadie tocó los mismos campos que
   * este jefe de turno cambia, según lo que veía en ellos (valoresBase). El estado y su regreso no se combinan: si la
   * máquina cambió, es conflicto. Sin valoresBase (versiones anteriores de la app o del panel) tampoco se combina.
   */
  private combinarConCambiosDeOtro(dto: EditarMaquinaDto, actual: MaquinaFlota, antes: FichaMaquina, valoresBase: Record<string, unknown> | null) {
    const pedidos = CAMPOS_FICHA.filter((campo) => dto[campo] !== undefined);
    if (dto.estado !== undefined || dto.regresoEstimado !== undefined || !valoresBase || pedidos.length === 0) {
      // La versión está desactualizada: responde el conflicto de siempre
      verificarVersionBase(actual, dto.versionBase);
      return;
    }
    const tocados = pedidos.filter((campo) => !(campo in valoresBase) || normalizar(valoresBase[campo]) !== normalizar(antes[campo]));
    if (tocados.length > 0) throw camposModificados(actual, enumerar(tocados.map((campo) => NOMBRE_CAMPO[campo])));
    // Nadie tocó estos campos: se guarda sobre la versión actual (guardarSinPisar cubre a quien se adelante ahora)
  }

  // marcaOTipoNuevo: hay que registrar el modelo en el catálogo después de guardar
  // operador: el nuevo operador asignado, si viene uno
  private async leerFicha(
    dto: EditarMaquinaDto,
    antes: FichaMaquina,
  ): Promise<{ ficha: FichaMaquina; marcaOTipoNuevo: boolean; operador: OperadorAsignable | null | undefined }> {
    const nombre = dto.nombre === undefined ? antes.nombre : textoMayusculas('nombre', dto.nombre);
    if (!nombre) throw maquinaError('DATOS_INVALIDOS', 'El código interno es obligatorio');

    let estado: EstadoMaquina = antes.estado;
    if (dto.estado !== undefined) {
      if (!esEstadoMaquina(dto.estado)) throw maquinaError('DATOS_INVALIDOS', 'El estado de la máquina no es válido');
      estado = dto.estado;
    }

    if (dto.esContratista !== undefined && typeof dto.esContratista !== 'boolean') {
      throw maquinaError('DATOS_INVALIDOS', 'El campo contratista no es válido');
    }

    const marcaIngresada = dto.marca === undefined ? antes.marca : texto('marca', dto.marca);
    const tipoIngresado = dto.tipoMaquina === undefined ? antes.tipoMaquina : texto('tipoMaquina', dto.tipoMaquina);
    // Si no vienen marca ni tipo (p. ej. un cambio de estado) se mantienen los guardados sin consultar los catálogos
    const marcaYTipo =
      dto.marca === undefined && dto.tipoMaquina === undefined
        ? { marca: antes.marca, tipoMaquina: antes.tipoMaquina, hayNuevo: false }
        : await normalizarMarcaYTipo(this.maquinaRepo, marcaIngresada, tipoIngresado);
    // Si viene el mismo operador que ya tiene, no hace falta buscarlo
    const operador = dto.idOperador === undefined || dto.idOperador === antes.idOperador ? undefined : await leerOperador(this.maquinaRepo, dto.idOperador);

    const ficha: FichaMaquina = {
      nombre,
      marca: marcaYTipo.marca,
      modelo: dto.modelo === undefined ? antes.modelo : texto('modelo', dto.modelo),
      anio: dto.anio === undefined ? antes.anio : leerAnio(dto.anio),
      tipoMaquina: marcaYTipo.tipoMaquina,
      patente: dto.patente === undefined ? antes.patente : textoMayusculas('patente', dto.patente),
      numeroChasis: dto.numeroChasis === undefined ? antes.numeroChasis : texto('numeroChasis', dto.numeroChasis),
      esContratista: dto.esContratista === undefined ? antes.esContratista : dto.esContratista,
      idOperador: operador === undefined ? antes.idOperador : (operador?.idOperador ?? null),
      estado,
    };
    return { ficha, marcaOTipoNuevo: marcaYTipo.hayNuevo, operador };
  }
}
