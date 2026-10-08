import { Injectable, Inject, Logger } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaFlota, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';
import { MODELO_MAQUINA_REPOSITORY } from '../../domain/repositories/modelo-maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { maquinaError } from '../maquina.errors';
import {
  accionesPorReasignacion,
  leerNuevaMaquina,
  leerOperador,
  registrarModeloSiEsNuevo,
  ROLES_GESTION_FLOTA,
  texto,
} from '../maquina.datos';
import type { NuevaMaquinaDto } from '../maquina.datos';

export interface CrearMaquinaDto extends NuevaMaquinaDto {
  rol: string;
  idUsuario?: number;
  idOperador?: unknown; // opcional: operador a cargo
  motivo?: unknown;
  observacion?: unknown;
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

    const { datos, marcaYTipo } = await leerNuevaMaquina(this.maquinaRepo, dto);
    const operador = await leerOperador(this.maquinaRepo, dto.idOperador);
    const registro = { idUsuario: dto.idUsuario, motivo, observacion };

    const maquina = await this.maquinaRepo.create(
      { ...datos, idOperador: operador?.idOperador ?? null },
      registro,
      accionesPorReasignacion(operador, null, datos.nombre, registro),
    );

    await registrarModeloSiEsNuevo(this.modeloRepo, this.logger, { ...marcaYTipo, modelo: datos.modelo });

    return maquina;
  }
}
