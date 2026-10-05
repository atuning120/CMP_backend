import { turnoError } from '../../../application/turno.errors';

export interface UsuarioAutenticado {
  idUsuario: number;
  rol: string;
  idOperador?: number;
}

// El operador sale siempre del JWT: el turno pertenece a la persona, no a la sesión,
// por lo que cerrar sesión no lo cierra y al volver a ingresar se recupera con GET /turnos/actual.
export const idOperadorDe = (user: UsuarioAutenticado): number => {
  if (!user?.idOperador) {
    throw turnoError('SIN_OPERADOR');
  }
  return user.idOperador;
};

export const numeroOpcional = (valor: unknown): number | null =>
  valor === undefined || valor === null || valor === '' ? null : Number(valor);
