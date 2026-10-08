import { Inject, Injectable, Logger } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type {
  AccionBitacora,
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
  leerAnio,
  leerOperador,
  normalizarMarcaYTipo,
  registrarModeloSiEsNuevo,
  ROLES_GESTION_FLOTA,
  texto,
  textoMayusculas,
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
  motivo?: unknown;
  observacion?: unknown;
}

type CampoFicha = Exclude<keyof FichaMaquina, 'estado'>;
const CAMPOS_FICHA: CampoFicha[] = ['nombre', 'marca', 'modelo', 'anio', 'tipoMaquina', 'patente', 'numeroChasis', 'esContratista', 'idOperador'];

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
      estado: actual.estado === 'BAJA' ? 'BAJA' : 'ACTIVA',
    };
    const { ficha: despues, marcaOTipoNuevo, operador } = await this.leerFicha(dto, antes);

    const cambiados = CAMPOS_FICHA.filter((campo) => despues[campo] !== antes[campo]);
    const cambiaEstado = despues.estado !== antes.estado;
    if (cambiados.length === 0 && !cambiaEstado) throw maquinaError('SIN_CAMBIOS');

    // Al editar se compara sin la propia máquina; cambiar solo mayúsculas no es un duplicado
    if (cambiados.includes('nombre') && (await this.maquinaRepo.existeNombre(despues.nombre, idMaquina))) {
      throw maquinaError('CODIGO_DUPLICADO', despues.nombre);
    }
    if (cambiados.includes('patente') && despues.patente && (await this.maquinaRepo.existePatente(despues.patente, idMaquina))) {
      throw maquinaError('PATENTE_DUPLICADA', despues.patente);
    }
    // Un operador la está usando: sacarla de servicio dejaría su turno en una máquina dada de baja
    if (cambiaEstado && despues.estado === 'BAJA' && (await this.maquinaRepo.tieneTurnoEnCurso(idMaquina))) {
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
    if (cambiaEstado) acciones.push({ ...registro, accion: despues.estado === 'ACTIVA' ? 'HABILITAR' : 'DESHABILITAR', detalle: null });

    const cambios: Partial<FichaMaquina> = Object.fromEntries(cambiados.map((campo) => [campo, despues[campo]]));
    if (cambiaEstado) cambios.estado = despues.estado;
    await this.maquinaRepo.actualizar(idMaquina, cambios, acciones);

    if (cambiados.some((campo) => campo === 'marca' || campo === 'modelo' || campo === 'tipoMaquina')) {
      await registrarModeloSiEsNuevo(this.modeloRepo, this.logger, {
        marca: despues.marca,
        modelo: despues.modelo,
        tipoMaquina: despues.tipoMaquina,
        hayNuevo: marcaOTipoNuevo,
      });
    }

    return (await this.maquinaRepo.findFlotaById(idMaquina)) ?? actual;
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
      if (dto.estado !== 'ACTIVA' && dto.estado !== 'BAJA') throw maquinaError('DATOS_INVALIDOS', 'El estado de la máquina no es válido');
      estado = dto.estado;
    }

    if (dto.esContratista !== undefined && typeof dto.esContratista !== 'boolean') {
      throw maquinaError('DATOS_INVALIDOS', 'El campo contratista no es válido');
    }

    const marcaIngresada = dto.marca === undefined ? antes.marca : texto('marca', dto.marca);
    const tipoIngresado = dto.tipoMaquina === undefined ? antes.tipoMaquina : texto('tipoMaquina', dto.tipoMaquina);
    const marcaYTipo = await normalizarMarcaYTipo(this.maquinaRepo, marcaIngresada, tipoIngresado);
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
