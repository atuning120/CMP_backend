export const OPERADOR_REPOSITORY = Symbol('OPERADOR_REPOSITORY');

// Datos personales del operador que se muestran en la app móvil
export interface PerfilOperador {
  nombre: string;
  apellido: string;
  rut: string;
}

export interface OperadorRepositoryPort {
  findByRut(rut: string): Promise<({ idOperador: number; estado: string } & PerfilOperador) | null>;
  findPerfil(idOperador: number): Promise<PerfilOperador | null>;
  create(data: { nombre: string; apellido: string; rut: string; telefono: string; estado: string }): Promise<number>;
}
