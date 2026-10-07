import { Injectable, Inject } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { MaquinaFlota, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';
import { maquinaError } from '../maquina.errors';

export interface CrearMaquinaDto {
  rol: string;
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

const ROLES_PERMITIDOS = ['JEFE_TURNO', 'ADMIN'];

// Largos máximos de las columnas en MAQUINA
const LARGOS = { nombre: 100, marca: 50, modelo: 50, tipoMaquina: 50, patente: 15, numeroChasis: 50 } as const;
type CampoTexto = keyof typeof LARGOS;

const ETIQUETAS: Record<CampoTexto, string> = {
  nombre: 'código interno',
  marca: 'marca',
  modelo: 'modelo',
  tipoMaquina: 'tipo de máquina',
  patente: 'patente',
  numeroChasis: 'N° de chasis',
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
  constructor(
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
  ) {}

  async execute(dto: CrearMaquinaDto): Promise<MaquinaFlota> {
    if (!ROLES_PERMITIDOS.includes(dto.rol)) throw maquinaError('SIN_PERMISO');

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

    return this.maquinaRepo.create({
      nombre,
      marca: texto('marca', dto.marca),
      modelo: texto('modelo', dto.modelo),
      anio,
      tipoMaquina: texto('tipoMaquina', dto.tipoMaquina),
      patente,
      numeroChasis: texto('numeroChasis', dto.numeroChasis),
      horometroInicial,
      esContratista: dto.esContratista === true,
    });
  }
}
