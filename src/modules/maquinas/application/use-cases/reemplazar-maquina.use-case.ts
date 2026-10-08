import { Inject, Injectable, Logger } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type {
  AccionBitacora,
  MaquinaFlota,
  MaquinaRepositoryPort,
  OperadorAsignable,
  OperadorAsignado,
  ReemplazoMaquina,
} from '../../domain/repositories/maquina.repository.port';
import { MODELO_MAQUINA_REPOSITORY } from '../../domain/repositories/modelo-maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { maquinaError } from '../maquina.errors';
import { leerNuevaMaquina, leerOperador, registrarModeloSiEsNuevo, ROLES_GESTION_FLOTA, texto } from '../maquina.datos';
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
  motivo?: unknown;
  observacion?: unknown;
}

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

    // Un operador la está usando: no se puede sacar de servicio con su turno abierto
    if (await this.maquinaRepo.tieneTurnoEnCurso(saliente.idMaquina)) throw maquinaError('MAQUINA_EN_USO', saliente.nombre);

    let existente: MaquinaFlota | null = null;
    let datosNueva: Awaited<ReturnType<typeof leerNuevaMaquina>> | null = null;
    if (deLaFlota) {
      existente = await this.buscar(dto.idMaquinaEntrante);
      if (!existente) throw maquinaError('DATOS_INVALIDOS', 'La máquina entrante no existe');
      if (existente.idMaquina === saliente.idMaquina) {
        throw maquinaError('DATOS_INVALIDOS', 'La máquina entrante debe ser distinta de la que sale');
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
      { ...registro, accion: 'REEMPLAZAR', detalle: { entrante: codigoEntrante, operador: operador?.nombre ?? null } },
    ];

    const accionesEntrante: AccionBitacora[] = [];
    if (datosNueva) {
      accionesEntrante.push({
        ...registro,
        accion: 'INCORPORAR',
        detalle: { ...datosNueva.datos, reemplazaA: saliente.nombre, operador: operador?.nombre ?? null },
      });
    } else if (existente) {
      if (existente.estado === 'BAJA') accionesEntrante.push({ ...registro, accion: 'HABILITAR', detalle: { reemplazaA: saliente.nombre } });
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

    const reemplazo: ReemplazoMaquina = {
      idSaliente: saliente.idMaquina,
      entrante: existente ? { idMaquina: existente.idMaquina, habilitar: existente.estado === 'BAJA' } : { nueva: datosNueva!.datos },
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
