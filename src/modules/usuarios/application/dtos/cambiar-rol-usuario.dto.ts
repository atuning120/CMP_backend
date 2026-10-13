export interface CambiarRolUsuarioDto {
  idUsuario: number;
  rol: unknown; // tal como llega del cliente; se valida en el caso de uso
  autor: { idUsuario: number; rol: string };
}
