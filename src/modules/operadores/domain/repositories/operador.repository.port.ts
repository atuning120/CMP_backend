export const OPERADOR_REPOSITORY = Symbol('OPERADOR_REPOSITORY');

export interface OperadorRepositoryPort {
  findByRut(rut: string): Promise<{ idOperador: number; estado: string } | null>;
}
