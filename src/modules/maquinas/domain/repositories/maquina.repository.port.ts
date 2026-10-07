export const MAQUINA_REPOSITORY = Symbol('MAQUINA_REPOSITORY');

export interface MaquinaResumen {
  idMaquina: number;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  tipoMaquina: string | null;
  estado: string | null;
}

// Máquina vista por el jefe de turno: incluye las dadas de baja y quién la opera ahora
export interface MaquinaFlota extends MaquinaResumen {
  patente: string | null;
  operadorActual: string | null; // operador con turno EN_CURSO en la máquina
  ubicacionActual: string | null; // zona (o área) vigente de ese turno
  horometroActual: number | null; // último horómetro registrado en un turno
}

export interface NuevaMaquina {
  nombre: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  tipoMaquina: string | null;
  patente: string | null;
  numeroChasis: string | null;
  horometroInicial: number;
  esContratista: boolean;
}

export interface MaquinaRepositoryPort {
  findById(idMaquina: number): Promise<MaquinaResumen | null>;
  findActivas(): Promise<MaquinaResumen[]>;
  // busqueda: texto ya normalizado; coincide con nombre, marca, modelo o tipo
  findFlota(busqueda: string | null): Promise<MaquinaFlota[]>;
  // Comparación sin distinguir mayúsculas, igual que los índices únicos
  existeNombre(nombre: string): Promise<boolean>;
  existePatente(patente: string): Promise<boolean>;
  create(datos: NuevaMaquina): Promise<MaquinaFlota>;
  // Tipos de máquina en uso: los de la flota y los del catálogo de modelos activos, sin repetir
  findTipos(): Promise<string[]>;
  // Marcas en uso, con el mismo criterio que findTipos
  findMarcas(): Promise<string[]>;
}
