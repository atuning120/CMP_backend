export const OPERADOR_REPOSITORY = Symbol('OPERADOR_REPOSITORY');

export interface OperadorRepositoryPort {
  findByRut(rut: string): Promise<{ idOperador: number; estado: string } | null>;
  create(data: { nombre: string; apellido: string; rut: string; telefono: string; estado: string }): Promise<number>;
}
