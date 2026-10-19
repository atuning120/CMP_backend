import { Inject, Injectable, Logger } from '@nestjs/common';
import { esEstadoMaquina, MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type {
  AccionBitacora,
  EstadoMaquina,
  EstadoSaliente,
  MaquinaFlota,
  MaquinaRepositoryPort,
  OperadorAsignable,
  OperadorAsignado,
  ReemplazoMaquina,
} from '../../domain/repositories/maquina.repository.port';
import { MODELO_MAQUINA_REPOSITORY } from '../../domain/repositories/modelo-maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { maquinaError } from '../maquina.errors';
import {
  leerNuevaMaquina,
  leerOperador,
  leerRegresoEstimado,
  registrarModeloSiEsNuevo,
  ROLES_GESTION_FLOTA,
  texto,
} from '../maquina.datos';
import type { MarcaYTipo, NuevaMaquinaDto } from '../maquina.datos';

export interface ReemplazarMaquinaDto {
  rol: string;
  idUsuario?: number;
  idMaquina: unknown; // la saliente
  // La entrante: una de la flota o una nueva (exactamente una de las dos)
  idMaquinaEntrante?: unknown;
  maquinaNueva?: NuevaMaquinaDto | null;
  // Operador de la entrante; ausente = el que tenía la saliente; null = sin operador
  idOperador?: unknown;
  // Cómo queda la saliente: EN_MANTENIMIENTO (vuelve tras la reparación) o BAJA. Ausente: si ya estaba en uno de
  // esos estados lo conserva; si no, BAJA
  estadoSaliente?: unknown;
  regresoEstimado?: unknown; // ISO; cuándo se espera que la saliente vuelva a operar
  motivo?: unknown;
  observacion?: unknown;
}

// La entrante que estaba fuera de servicio o en reserva entra a operar
const habilitar = (maquina: MaquinaFlota) => maquina.estado === 'BAJA' || maquina.estado === 'EN_RESERVA';

const ESTADOS_SALIENTE: readonly EstadoSaliente[] = ['EN_MANTENIMIENTO', 'BAJA'];

const leerEstadoSaliente = (valor: unknown, actual: string | null): EstadoSaliente => {
  if (valor === undefined || valor === null) {
    return ESTADOS_SALIENTE.includes(actual as EstadoSaliente) ? (actual as EstadoSaliente) : 'BAJA';
  }
  if (!ESTADOS_SALIENTE.includes(valor as EstadoSaliente)) {
    throw maquinaError('DATOS_INVALIDOS', 'La máquina que sale queda en mantenimiento o fuera de servicio');
  }
  return valor as EstadoSaliente;
};

export interface ResultadoReemplazo {
  saliente: MaquinaFlota;
  entrante: MaquinaFlota;
}

@Injectable()
export class ReemplazarMaquinaUseCase {
  private readonly logger = new Logger(ReemplazarMaquinaUseCase.name);

  constructor(
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
    @Inject(MODELO_MAQUINA_REPOSITORY)
    private readonly modeloRepo: ModeloMaquinaRepositoryPort,
  ) {}

  async execute(dto: ReemplazarMaquinaDto): Promise<ResultadoReemplazo> {
    if (!ROLES_GESTION_FLOTA.includes(dto.rol) || !dto.idUsuario) throw maquinaError('SIN_PERMISO');

    const saliente = await this.buscar(dto.idMaquina);
    if (!saliente) throw maquinaError('MAQUINA_NO_ENCONTRADA');

    const motivo = texto('motivo', dto.motivo);
    if (!motivo) throw maquinaError('DATOS_INVALIDOS', 'El motivo del reemplazo es obligatorio');
    const observacion = texto('observacion', dto.observacion);

    const deLaFlota = dto.idMaquinaEntrante !== undefined && dto.idMaquinaEntrante !== null;
    const nueva = dto.maquinaNueva !== undefined && dto.maquinaNueva !== null;
    if (deLaFlota === nueva) throw maquinaError('DATOS_INVALIDOS', 'Indica la máquina entrante: una de la flota o una nueva');

    // El reemplazo saca a la saliente de operación (en mantenimiento o fuera de servicio) en el mismo paso
    const estadoSaliente = leerEstadoSaliente(dto.estadoSaliente, saliente.estado);
    const regresoEstimado = leerRegresoEstimado(dto.regresoEstimado) ?? null;
    // Ya tiene un respaldo: primero se devuelve ese (si no, se perdería a qué estado vuelve)
    if (saliente.respaldo) {
      throw maquinaError('DATOS_INVALIDOS', `${saliente.nombre} ya está cubierta por ${saliente.respaldo.nombre}`);
    }
    // Un operador la está usando: el jefe de turno primero cierra ese turno con el horómetro final
    if (await this.maquinaRepo.tieneTurnoEnCurso(saliente.idMaquina)) throw maquinaError('MAQUINA_EN_USO', saliente.nombre);

    let existente: MaquinaFlota | null = null;
    let datosNueva: Awaited<ReturnType<typeof leerNuevaMaquina>> | null = null;
    if (deLaFlota) {
      existente = await this.buscar(dto.idMaquinaEntrante);
      if (!existente) throw maquinaError('DATOS_INVALIDOS', 'La máquina entrante no existe');
      if (existente.idMaquina === saliente.idMaquina) {
        throw maquinaError('DATOS_INVALIDOS', 'La máquina entrante debe ser distinta de la que sale');
      }
      // El respaldo tiene que poder trabajar
      if (existente.estado === 'EN_MANTENIMIENTO') {
        throw maquinaError('DATOS_INVALIDOS', `${existente.nombre} está en mantenimiento: no puede ser el respaldo`);
      }
      if (existente.cubreA) {
        throw maquinaError('DATOS_INVALIDOS', `${existente.nombre} ya es el respaldo de ${existente.cubreA.nombre}`);
      }
    } else {
      datosNueva = await leerNuevaMaquina(this.maquinaRepo, dto.maquinaNueva as NuevaMaquinaDto);
    }
    const codigoEntrante = existente?.nombre ?? datosNueva!.datos.nombre;

    // Por defecto el operador de la saliente pasa a la entrante
    const operador: OperadorAsignado | OperadorAsignable | null =
      dto.idOperador === undefined ? saliente.operadorAsignado : ((await leerOperador(this.maquinaRepo, dto.idOperador)) ?? null);

    const registro = { idUsuario: dto.idUsuario, motivo, observacion };
    const accionesSaliente: AccionBitacora[] = [
      {
        ...registro,
        accion: 'REEMPLAZAR',
        detalle: {
          entrante: codigoEntrante,
          operador: operador?.nombre ?? null,
          antes: { estado: saliente.estado },
          despues: { estado: estadoSaliente, ...(regresoEstimado ? { regresoEstimado: regresoEstimado.toISOString() } : {}) },
        },
      },
    ];

    const accionesEntrante: AccionBitacora[] = [];
    if (datosNueva) {
      accionesEntrante.push({
        ...registro,
        accion: 'INCORPORAR',
        detalle: { ...datosNueva.datos, reemplazaA: saliente.nombre, operador: operador?.nombre ?? null },
      });
    } else if (existente) {
      if (habilitar(existente)) {
        accionesEntrante.push({
          ...registro,
          accion: existente.estado === 'BAJA' ? 'HABILITAR' : 'CAMBIAR_ESTADO',
          detalle: { reemplazaA: saliente.nombre, antes: { estado: existente.estado }, despues: { estado: 'ACTIVA' } },
        });
      }
      const operadorAntes = existente.operadorAsignado;
      if ((operadorAntes?.idOperador ?? null) !== (operador?.idOperador ?? null)) {
        accionesEntrante.push({
          ...registro,
          accion: 'EDITAR',
          detalle: { antes: { operador: operadorAntes?.nombre ?? null }, despues: { operador: operador?.nombre ?? null } },
        });
      }
    }

    // Si el operador venía de una tercera máquina, esa máquina lo pierde (la saliente ya queda en REEMPLAZAR)
    const anterior = operador && 'maquinaAsignada' in operador ? (operador as OperadorAsignable).maquinaAsignada : null;
    const accionesOtras: AccionBitacora[] =
      operador && anterior && anterior.idMaquina !== saliente.idMaquina && anterior.idMaquina !== existente?.idMaquina
        ? [
            {
              ...registro,
              idMaquina: anterior.idMaquina,
              accion: 'EDITAR',
              observacion: `${operador.nombre} pasó a ${codigoEntrante}`,
              detalle: { antes: { operador: operador.nombre }, despues: { operador: null } },
            },
          ]
        : [];

    // Al devolver, el respaldo vuelve a su estado anterior; una máquina recién incorporada queda en reserva
    const estadoPrevioEntrante: EstadoMaquina = existente ? (esEstadoMaquina(existente.estado) ? existente.estado : 'ACTIVA') : 'EN_RESERVA';
    const reemplazo: ReemplazoMaquina = {
      idSaliente: saliente.idMaquina,
      estadoSaliente,
      regresoEstimado,
      estadoPrevioEntrante,
      entrante: existente ? { idMaquina: existente.idMaquina, habilitar: habilitar(existente) } : { nueva: datosNueva!.datos },
      idOperador: operador?.idOperador ?? null,
      accionesSaliente,
      accionesEntrante,
      accionesOtras,
    };
    const idEntrante = await this.maquinaRepo.reemplazar(reemplazo);

    if (datosNueva) await this.registrarModelo(datosNueva.marcaYTipo, datosNueva.datos.modelo);

    const [salienteFinal, entranteFinal] = await Promise.all([
      this.maquinaRepo.findFlotaById(saliente.idMaquina),
      this.maquinaRepo.findFlotaById(idEntrante),
    ]);
    if (!salienteFinal || !entranteFinal) throw new Error('No se encontraron las máquinas después del reemplazo');
    return { saliente: salienteFinal, entrante: entranteFinal };
  }

  private async buscar(valor: unknown): Promise<MaquinaFlota | null> {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? this.maquinaRepo.findFlotaById(id) : null;
  }

  private registrarModelo(marcaYTipo: MarcaYTipo, modelo: string | null) {
    return registrarModeloSiEsNuevo(this.modeloRepo, this.logger, { ...marcaYTipo, modelo });
  }
}
