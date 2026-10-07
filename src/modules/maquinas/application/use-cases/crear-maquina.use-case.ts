import { Injectable, Inject, Logger } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaFlota, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';
import { MODELO_MAQUINA_REPOSITORY } from '../../domain/repositories/modelo-maquina.repository.port';
import type { ModeloMaquinaRepositoryPort } from '../../domain/repositories/modelo-maquina.repository.port';
import { maquinaError } from '../maquina.errors';

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
  motivo?: unknown;
  observacion?: unknown;
}

const ROLES_PERMITIDOS = ['JEFE_TURNO', 'ADMIN'];

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

const texto = (campo: CampoTexto, valor: unknown): string | null => {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw maquinaError('DATOS_INVALIDOS', `El campo ${ETIQUETAS[campo]} no es válido`);
  const limpio = valor.trim();
  if (limpio.length > LARGOS[campo]) {
    throw maquinaError('DATOS_INVALIDOS', `El campo ${ETIQUETAS[campo]} admite hasta ${LARGOS[campo]} caracteres`);
  }
  return limpio === '' ? null : limpio;
};

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
    if (!ROLES_PERMITIDOS.includes(dto.rol) || !dto.idUsuario) throw maquinaError('SIN_PERMISO');

    // Toda incorporación queda justificada en la bitácora del jefe de turno
    const motivo = texto('motivo', dto.motivo);
    if (!motivo) throw maquinaError('DATOS_INVALIDOS', 'El motivo de la incorporación es obligatorio');
    const observacion = texto('observacion', dto.observacion);

    // Código y patente se guardan en mayúsculas, como se rotulan en faena
    const nombre = texto('nombre', dto.nombre)?.toUpperCase() ?? null;
    if (!nombre) throw maquinaError('DATOS_INVALIDOS', 'El código interno es obligatorio');
    const patente = texto('patente', dto.patente)?.toUpperCase() ?? null;

    const horometroInicial = Number(dto.horometroInicial);
    if (dto.horometroInicial === null || dto.horometroInicial === '' || !Number.isFinite(horometroInicial) || horometroInicial < 0) {
      throw maquinaError('HOROMETRO_INVALIDO');
    }

    let anio: number | null = null;
    if (dto.anio !== undefined && dto.anio !== null && dto.anio !== '') {
      anio = Number(dto.anio);
      if (!Number.isInteger(anio) || anio < 1950 || anio > new Date().getFullYear() + 1) throw maquinaError('ANIO_INVALIDO');
    }

    if (await this.maquinaRepo.existeNombre(nombre)) throw maquinaError('CODIGO_DUPLICADO', nombre);
    if (patente && (await this.maquinaRepo.existePatente(patente))) throw maquinaError('PATENTE_DUPLICADA', patente);

    const modelo = texto('modelo', dto.modelo);
    // Marca y tipo que ya existen con otras mayúsculas se guardan con la escritura existente, para no duplicarlos
    const marcaIngresada = texto('marca', dto.marca);
    const tipoIngresado = texto('tipoMaquina', dto.tipoMaquina);
    const [marcaExistente, tipoExistente] = await Promise.all([
      marcaIngresada ? this.buscarExistente(marcaIngresada, () => this.maquinaRepo.findMarcas()) : undefined,
      tipoIngresado ? this.buscarExistente(tipoIngresado, () => this.maquinaRepo.findTipos()) : undefined,
    ]);
    const marca = marcaExistente ?? marcaIngresada;
    const tipoMaquina = tipoExistente ?? tipoIngresado;

    const maquina = await this.maquinaRepo.create({
      nombre,
      marca,
      modelo,
      anio,
      tipoMaquina,
      patente,
      numeroChasis: texto('numeroChasis', dto.numeroChasis),
      horometroInicial,
      esContratista: dto.esContratista === true,
    }, { idUsuario: dto.idUsuario, motivo, observacion });

    // Marca o tipo nuevo: queda registrado como modelo para que aparezca en los selectores y en "Datos Previos"
    if (marca && modelo && tipoMaquina && (!marcaExistente || !tipoExistente)) {
      try {
        await this.modeloRepo.crearSiNoExiste({
          nombre: `${tipoMaquina} ${marca} ${modelo}`.slice(0, 100),
          marca,
          modelo,
          tipoMaquina,
        });
      } catch (error) {
        // La máquina ya quedó creada: no se revierte por no poder registrar el modelo
        this.logger.warn(`No se pudo registrar el modelo "${marca} ${modelo}" (${tipoMaquina}): ${String(error)}`);
      }
    }

    return maquina;
  }

  private async buscarExistente(valor: string, listar: () => Promise<string[]>): Promise<string | undefined> {
    return (await listar()).find((existente) => existente.toUpperCase() === valor.toUpperCase());
  }
}
