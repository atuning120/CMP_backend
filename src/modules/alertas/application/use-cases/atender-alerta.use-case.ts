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
  idCliente?: unknown; // UUID generado por el cliente: un reintento no duplica la atención
  // Cuántas atenciones tenía la alerta cuando el jefe de turno la atendió. Si otro la atendió entremedio, la suya se
  // agrega igual (aunque no tenga comentario): las dos quedan registradas
  atencionesVistas?: unknown;
  // Cuándo la atendió (ISO 8601). La app la envía al sincronizar una atención hecha sin señal; si falta, es ahora
  fechaAccion?: unknown;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Las notas de una alerta no vencen: se acepta cualquier fecha pasada. Una futura (reloj del teléfono adelantado) queda en ahora
const fechaDeAccion = (fechaAccion: unknown): Date | null => {
  if (fechaAccion === undefined || fechaAccion === null) return null;
  const fecha = typeof fechaAccion === 'string' ? new Date(fechaAccion) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) throw alertaError('DATOS_INVALIDOS');
  return fecha.getTime() > Date.now() ? null : fecha;
};

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

  async execute({ idAlerta, comentario, autor, idCliente, atencionesVistas, fechaAccion }: AtenderAlertaDto): Promise<{ idAlerta: string; atenciones: AtencionAlerta[] }> {
    if (!ROLES_ALERTAS.includes(autor?.rol) || !autor.idUsuario) throw alertaError('SIN_PERMISO');

    const partes = /^([EJAM])-(\d{1,9})$/.exec(typeof idAlerta === 'string' ? idAlerta : '');
    if (!partes) throw alertaError('ALERTA_NO_ENCONTRADA');
    const tipo = TIPO_POR_PREFIJO[partes[1]];

    const texto = typeof comentario === 'string' ? comentario.trim() : '';
    if (texto.length > LARGO_MAXIMO_COMENTARIO) throw alertaError('COMENTARIO_LARGO');

    if (idCliente !== undefined && idCliente !== null && (typeof idCliente !== 'string' || !UUID_REGEX.test(idCliente))) {
      throw alertaError('DATOS_INVALIDOS');
    }
    const vistas = atencionesVistas === undefined || atencionesVistas === null ? null : Number(atencionesVistas);
    if (vistas !== null && (!Number.isInteger(vistas) || vistas < 0)) throw alertaError('DATOS_INVALIDOS');
    const uuid = typeof idCliente === 'string' ? idCliente.toLowerCase() : null;
    const fecha = fechaDeAccion(fechaAccion);

    const idTurno = await this.alertaRepo.turnoDeAlerta(tipo, Number(partes[2]));
    if (idTurno === null) throw alertaError('ALERTA_NO_ENCONTRADA');
    // Reintento de una atención ya registrada: se responde con lo que hay, sin agregarla otra vez
    if (uuid && (await this.atencionRepo.existeIdCliente(uuid))) return { idAlerta, atenciones: await this.atencionRepo.listar(idAlerta) };

    const previas = await this.atencionRepo.listar(idAlerta);
    // Una nota sobre una alerta ya atendida necesita comentario, salvo que otro jefe la haya atendido sin que este lo viera
    const atendidaEntremedio = vistas !== null && previas.length > vistas;
    if (previas.length > 0 && !texto && !atendidaEntremedio) throw alertaError('NOTA_VACIA');

    await this.atencionRepo.registrar({ idAlerta, idTurno, idUsuario: autor.idUsuario, comentario: texto || null, idCliente: uuid, fecha });
    const atenciones = await this.atencionRepo.listar(idAlerta);
    this.publicador.publicarAtencion({ idAlerta, atenciones });
    this.logger.log(`Usuario ${autor.idUsuario} ${previas.length ? 'agregó una nota a' : 'atendió'} la alerta ${idAlerta}`);
    return { idAlerta, atenciones };
  }
}
