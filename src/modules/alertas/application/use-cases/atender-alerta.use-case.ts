import { Inject, Injectable, Logger } from '@nestjs/common';
import { ALERTA_TURNO_REPOSITORY, PREFIJO_ALERTA } from '../../domain/repositories/alerta-turno.repository.port';
import type { AlertaTurnoRepositoryPort, AtencionAlerta, TipoAlertaTurno } from '../../domain/repositories/alerta-turno.repository.port';
import { ATENCION_ALERTA_REPOSITORY } from '../../domain/repositories/atencion-alerta.repository.port';
import type { AtencionAlertaRepositoryPort } from '../../domain/repositories/atencion-alerta.repository.port';
import { PUBLICADOR_ALERTAS } from '../ports/publicador-alertas.port';
import type { PublicadorAlertasPort } from '../ports/publicador-alertas.port';
import { alertaError, LARGO_MAXIMO_COMENTARIO } from '../alerta.errors';
import { ROLES_ALERTAS } from './listar-alertas.use-case';

export interface AtenderAlertaDto {
  idAlerta: string;
  comentario: unknown; // tal como llega del cliente
  autor: { idUsuario: number; rol: string };
}

const TIPO_POR_PREFIJO = Object.fromEntries(Object.entries(PREFIJO_ALERTA).map(([tipo, prefijo]) => [prefijo, tipo])) as Record<
  string,
  TipoAlertaTurno
>;

/**
 * Registra la atención de una alerta de turno (jefe de turno o administrador). La primera vez la deja atendida
 * (comentario opcional); después solo se agregan notas (comentario obligatorio). No se edita ni se borra nada:
 * queda quién, cuándo y qué dijo. Avisa en tiempo real a los demás paneles abiertos.
 */
@Injectable()
export class AtenderAlertaUseCase {
  private readonly logger = new Logger(AtenderAlertaUseCase.name);

  constructor(
    @Inject(ALERTA_TURNO_REPOSITORY)
    private readonly alertaRepo: AlertaTurnoRepositoryPort,
    @Inject(ATENCION_ALERTA_REPOSITORY)
    private readonly atencionRepo: AtencionAlertaRepositoryPort,
    @Inject(PUBLICADOR_ALERTAS)
    private readonly publicador: PublicadorAlertasPort,
  ) {}

  async execute({ idAlerta, comentario, autor }: AtenderAlertaDto): Promise<{ idAlerta: string; atenciones: AtencionAlerta[] }> {
    if (!ROLES_ALERTAS.includes(autor?.rol) || !autor.idUsuario) throw alertaError('SIN_PERMISO');

    const partes = /^([EJA])-(\d{1,9})$/.exec(typeof idAlerta === 'string' ? idAlerta : '');
    if (!partes) throw alertaError('ALERTA_NO_ENCONTRADA');
    const tipo = TIPO_POR_PREFIJO[partes[1]];
    const idTurno = Number(partes[2]);

    const texto = typeof comentario === 'string' ? comentario.trim() : '';
    if (texto.length > LARGO_MAXIMO_COMENTARIO) throw alertaError('COMENTARIO_LARGO');

    if (!(await this.alertaRepo.existe(tipo, idTurno))) throw alertaError('ALERTA_NO_ENCONTRADA');
    const previas = await this.atencionRepo.listar(idAlerta);
    if (previas.length > 0 && !texto) throw alertaError('NOTA_VACIA');

    await this.atencionRepo.registrar({ idAlerta, idTurno, idUsuario: autor.idUsuario, comentario: texto || null });
    const atenciones = await this.atencionRepo.listar(idAlerta);
    this.publicador.publicarAtencion({ idAlerta, atenciones });
    this.logger.log(`Usuario ${autor.idUsuario} ${previas.length ? 'agregó una nota a' : 'atendió'} la alerta ${idAlerta}`);
    return { idAlerta, atenciones };
  }
}
