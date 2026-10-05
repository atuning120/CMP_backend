export const MAQUINA_REPOSITORY = Symbol('MAQUINA_REPOSITORY');

export interface MaquinaResumen {
  idMaquina: number;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  tipoMaquina: string | null;
  estado: string | null;
}

export interface MaquinaRepositoryPort {
  findById(idMaquina: number): Promise<MaquinaResumen | null>;
  findActivas(): Promise<MaquinaResumen[]>;
}
