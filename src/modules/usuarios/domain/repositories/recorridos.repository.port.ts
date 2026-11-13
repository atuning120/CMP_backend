export const RECORRIDOS_REPOSITORY = Symbol('RECORRIDOS_REPOSITORY');

// Recorridos guiados del panel web que cada usuario ya hizo u omitió (columna USUARIO.recorridos_vistos)
export interface RecorridosRepositoryPort {
  // null si el usuario no existe
  vistos(idUsuario: number): Promise<string[] | null>;
  // Lo agrega una sola vez y devuelve la lista actualizada (null si el usuario no existe)
  marcarVisto(idUsuario: number, recorrido: string): Promise<string[] | null>;
}
