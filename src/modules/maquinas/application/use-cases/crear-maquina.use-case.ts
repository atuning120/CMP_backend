import { Injectable, Inject, Logger } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaFlota, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';
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

export interface CrearMaquinaDto {
  rol: string;
  idUsuario?: number;
  nombre: unknown;
  marca?: unknown;
  modelo?: unknown;
  anio?: unknown;
  tipoMaquina?: unknown;
  patente?: unknown;
  numeroChasis?: unknown;
  horometroInicial: unknown;
  esContratista?: unknown;
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

    const nombre = textoMayusculas('nombre', dto.nombre);
    if (!nombre) throw maquinaError('DATOS_INVALIDOS', 'El código interno es obligatorio');
    const patente = textoMayusculas('patente', dto.patente);

    const horometroInicial = Number(dto.horometroInicial);
    if (dto.horometroInicial === null || dto.horometroInicial === '' || !Number.isFinite(horometroInicial) || horometroInicial < 0) {
      throw maquinaError('HOROMETRO_INVALIDO');
    }

    const anio = leerAnio(dto.anio);

    if (await this.maquinaRepo.existeNombre(nombre)) throw maquinaError('CODIGO_DUPLICADO', nombre);
    if (patente && (await this.maquinaRepo.existePatente(patente))) throw maquinaError('PATENTE_DUPLICADA', patente);

    const operador = await leerOperador(this.maquinaRepo, dto.idOperador);
    const registro = { idUsuario: dto.idUsuario, motivo, observacion };

    const modelo = texto('modelo', dto.modelo);
    const marcaYTipo = await normalizarMarcaYTipo(this.maquinaRepo, texto('marca', dto.marca), texto('tipoMaquina', dto.tipoMaquina));

    const maquina = await this.maquinaRepo.create({
      nombre,
      marca: marcaYTipo.marca,
      modelo,
      anio,
      tipoMaquina: marcaYTipo.tipoMaquina,
      patente,
      numeroChasis: texto('numeroChasis', dto.numeroChasis),
      horometroInicial,
      esContratista: dto.esContratista === true,
      idOperador: operador?.idOperador ?? null,
    }, registro, accionesPorReasignacion(operador, null, nombre, registro));

    await registrarModeloSiEsNuevo(this.modeloRepo, this.logger, { ...marcaYTipo, modelo });

    return maquina;
  }
}
