import { Inject, Injectable } from '@nestjs/common';
import { RECORRIDOS_REPOSITORY } from '../../domain/repositories/recorridos.repository.port';
import type { RecorridosRepositoryPort } from '../../domain/repositories/recorridos.repository.port';
import { usuarioError } from '../usuario.errors';

// Roles con panel web (un OPERADOR entra a la web como VISOR, así que su token web ya dice VISOR)
const ROLES_WEB = ['ADMIN', 'JEFE_TURNO', 'VISOR'];

// Identificador de un recorrido: '<canal>.<rol>.v<n>', p. ej. 'web.visor.v1'. Lo define el Frontend; aquí solo se
// acota su forma para que la lista no se llene de texto arbitrario
export const RECORRIDO_VALIDO = /^[a-z0-9_-]{1,20}\.[a-z0-9_-]{1,20}\.v[0-9]{1,3}$/;

export interface RecorridosVistos {
  vistos: string[];
}

interface Autor {
  idUsuario: number;
  rol: string;
}

const validarAutor = (autor: Autor | undefined) => {
  if (!autor?.idUsuario || !ROLES_WEB.includes(autor.rol)) throw usuarioError('SIN_PERMISO_RECORRIDO');
};

/**
 * Recorridos guiados que el usuario de la sesión ya hizo u omitió. Lista vacía = primer ingreso al panel: el Frontend
 * le ofrece el recorrido de su rol.
 */
@Injectable()
export class ObtenerRecorridosUseCase {
  constructor(@Inject(RECORRIDOS_REPOSITORY) private readonly repo: RecorridosRepositoryPort) {}

  async execute(autor: Autor | undefined): Promise<RecorridosVistos> {
    validarAutor(autor);
    const vistos = await this.repo.vistos(autor!.idUsuario);
    if (!vistos) throw usuarioError('USUARIO_NO_ENCONTRADO');
    return { vistos };
  }
}

/**
 * Marca un recorrido como visto (terminado u omitido) para el usuario de la sesión: no se vuelve a ofrecer solo,
 * aunque se puede repetir desde el botón de ayuda del panel. Idempotente.
 */
@Injectable()
export class MarcarRecorridoVistoUseCase {
  constructor(@Inject(RECORRIDOS_REPOSITORY) private readonly repo: RecorridosRepositoryPort) {}

  async execute({ recorrido, autor }: { recorrido: string; autor: Autor | undefined }): Promise<RecorridosVistos> {
    validarAutor(autor);
    if (typeof recorrido !== 'string' || !RECORRIDO_VALIDO.test(recorrido)) throw usuarioError('RECORRIDO_INVALIDO');
    const vistos = await this.repo.marcarVisto(autor!.idUsuario, recorrido);
    if (!vistos) throw usuarioError('USUARIO_NO_ENCONTRADO');
    return { vistos };
  }
}
