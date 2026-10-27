import { Injectable, Inject, Logger } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaFlota, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';
import { MODELO_MAQUINA_REPOSITORY } from '../../domain/repositories/modelo-maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { maquinaError } from '../maquina.errors';
import {
  accionesPorReasignacion,
  leerIdCliente,
  leerNuevaMaquina,
  leerOperador,
  registrarModeloSiEsNuevo,
  ROLES_GESTION_FLOTA,
  texto,
  verificarMaquinaDelOperador,
  verificarVigencia,
} from '../maquina.datos';
import type { NuevaMaquinaDto } from '../maquina.datos';

export interface CrearMaquinaDto extends NuevaMaquinaDto {
  rol: string;
  idUsuario?: number;
  idOperador?: unknown; // opcional: operador a cargo
  motivo?: unknown;
  observacion?: unknown;
  idCliente?: unknown; // UUID generado por el cliente: un reintento devuelve la misma máquina
  valoresBase?: unknown; // { maquinaOperador }: la máquina en que el jefe de turno vio al operador que asigna
  fechaAccion?: unknown; // cuándo la incorporó, si fue sin señal: pasadas 72 h ya no se aplica
}

@Injectable()
export class CrearMaquinaUseCase {
  private readonly logger = new Logger(CrearMaquinaUseCase.name);

  constructor(
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
    @Inject(MODELO_MAQUINA_REPOSITORY)
    private readonly modeloRepo: ModeloMaquinaRepositoryPort,
  ) {}

  async execute(dto: CrearMaquinaDto): Promise<MaquinaFlota> {
    if (!ROLES_GESTION_FLOTA.includes(dto.rol) || !dto.idUsuario) throw maquinaError('SIN_PERMISO');

    // Toda incorporación queda justificada en la bitácora del jefe de turno
    const motivo = texto('motivo', dto.motivo);
    if (!motivo) throw maquinaError('DATOS_INVALIDOS', 'El motivo de la incorporación es obligatorio');
    const observacion = texto('observacion', dto.observacion);

    const idCliente = leerIdCliente(dto.idCliente);
    // Reintento de una incorporación ya guardada (p. ej. la respuesta no llegó): se devuelve la misma máquina
    const yaCreada = idCliente ? await this.encontrar(idCliente) : null;
    if (yaCreada) return yaCreada;
    verificarVigencia(dto.fechaAccion);

    const { datos, marcaYTipo } = await leerNuevaMaquina(this.maquinaRepo, dto);
    const operador = await leerOperador(this.maquinaRepo, dto.idOperador);
    const valoresBase = typeof dto.valoresBase === 'object' && dto.valoresBase !== null ? (dto.valoresBase as Record<string, unknown>) : null;
    verificarMaquinaDelOperador(operador, valoresBase?.maquinaOperador);
    const registro = { idUsuario: dto.idUsuario, motivo, observacion };

    let maquina: MaquinaFlota;
    try {
      maquina = await this.maquinaRepo.create(
        { ...datos, idOperador: operador?.idOperador ?? null, idCliente },
        registro,
        accionesPorReasignacion(operador, null, datos.nombre, registro),
      );
    } catch (error) {
      // Dos reintentos simultáneos: el segundo choca con id_cliente único y responde con la del primero
      const delOtro = idCliente ? await this.encontrar(idCliente) : null;
      if (delOtro) return delOtro;
      throw error;
    }

    await registrarModeloSiEsNuevo(this.modeloRepo, this.logger, { ...marcaYTipo, modelo: datos.modelo });

    return maquina;
  }

  private async encontrar(idCliente: string): Promise<MaquinaFlota | null> {
    const idMaquina = await this.maquinaRepo.findIdPorIdCliente(idCliente);
    return idMaquina === null ? null : this.maquinaRepo.findFlotaById(idMaquina);
  }
}
