import { Inject, Injectable, Logger } from '@nestjs/common';
import { accionVencida } from '../../../../shared/application/vigencia-accion';
import { ATENCION_ALERTA_REPOSITORY } from '../../domain/repositories/atencion-alerta.repository.port';
import type { AtencionAlertaRepositoryPort } from '../../domain/repositories/atencion-alerta.repository.port';
import type { AtencionAlerta } from '../../domain/repositories/alerta-turno.repository.port';
import { REGULARIZACION_HOROMETRO_REPOSITORY } from '../../domain/repositories/regularizacion-horometro.repository.port';
import type { RegularizacionHorometroRepositoryPort } from '../../domain/repositories/regularizacion-horometro.repository.port';
import { PUBLICADOR_ALERTAS } from '../ports/publicador-alertas.port';
import type { PublicadorAlertasPort } from '../ports/publicador-alertas.port';
import { alertaError, horometroFueraDeRango, LARGO_MAXIMO_COMENTARIO } from '../alerta.errors';
import { fechaDeAccion, UUID_REGEX } from './atender-alerta.use-case';
import { ROLES_ALERTAS } from './listar-alertas.use-case';

// Lo que cabe en NUMERIC(10,2)
const HOROMETRO_MAXIMO = 99_999_999.99;

export interface RegularizarHorometroDto {
  idAlerta: string;
  horometroFinal: unknown;
  comentario?: unknown;
  autor: { idUsuario: number; rol: string };
  idCliente?: unknown; // UUID generado por el cliente: un reintento no la repite
  fechaAccion?: unknown; // cuándo lo hizo, si fue sin señal y se envía después
}

export interface HorometroRegularizado {
  idAlerta: string;
  atenciones: AtencionAlerta[];
  horometroFinal: number;
}

/**
 * El jefe de turno informa el horómetro final de un turno que el sistema cerró a las 13 h sin él (el operador olvidó
 * cerrarlo). Se hace desde la alerta de cierre automático: el horómetro queda en el turno, la acción en la bitácora y
 * la alerta queda atendida. Gana el primero que lo informa. El máximo es el horómetro con que partió el turno siguiente
 * de la máquina: la máquina no pudo marcar más que eso.
 */
@Injectable()
export class RegularizarHorometroUseCase {
  private readonly logger = new Logger(RegularizarHorometroUseCase.name);

  constructor(
    @Inject(REGULARIZACION_HOROMETRO_REPOSITORY)
    private readonly regularizacionRepo: RegularizacionHorometroRepositoryPort,
    @Inject(ATENCION_ALERTA_REPOSITORY)
    private readonly atencionRepo: AtencionAlertaRepositoryPort,
    @Inject(PUBLICADOR_ALERTAS)
    private readonly publicador: PublicadorAlertasPort,
  ) {}

  async execute(dto: RegularizarHorometroDto, ahora: Date = new Date()): Promise<HorometroRegularizado> {
    const { idAlerta, autor } = dto;
    if (!ROLES_ALERTAS.includes(autor?.rol) || !autor.idUsuario) throw alertaError('SIN_PERMISO');

    const partes = /^A-(\d{1,9})$/.exec(typeof idAlerta === 'string' ? idAlerta : '');
    if (!partes) throw alertaError('ALERTA_NO_ENCONTRADA');

    const comentario = typeof dto.comentario === 'string' ? dto.comentario.trim() : '';
    if (comentario.length > LARGO_MAXIMO_COMENTARIO) throw alertaError('COMENTARIO_LARGO');

    const { idCliente } = dto;
    if (idCliente !== undefined && idCliente !== null && (typeof idCliente !== 'string' || !UUID_REGEX.test(idCliente))) {
      throw alertaError('DATOS_INVALIDOS');
    }
    const uuid = typeof idCliente === 'string' ? idCliente.toLowerCase() : null;

    const fecha = fechaDeAccion(dto.fechaAccion);
    // Hecho sin señal hace más de 72 h: ya no se aplica (la app lo descarta antes; esto es el respaldo)
    if (fecha && accionVencida(fecha, ahora)) throw alertaError('ACCION_VENCIDA');

    const horometro = typeof dto.horometroFinal === 'number' ? Math.round(dto.horometroFinal * 100) / 100 : Number.NaN;
    if (!Number.isFinite(horometro) || horometro < 0 || horometro > HOROMETRO_MAXIMO) throw alertaError('HOROMETRO_INVALIDO');

    const idTurno = Number(partes[1]);
    const turno = await this.regularizacionRepo.turnoCerradoAutomaticamente(idTurno);
    if (!turno) throw alertaError('ALERTA_NO_ENCONTRADA');

    // Reintento de una regularización ya guardada: se responde con lo que quedó
    if (uuid && turno.horometroFinal !== null && (await this.regularizacionRepo.existeIdCliente(uuid))) {
      return { idAlerta, atenciones: await this.atencionRepo.listar(idAlerta), horometroFinal: turno.horometroFinal };
    }
    if (turno.horometroFinal !== null) throw alertaError('HOROMETRO_YA_INFORMADO');

    if (horometro < turno.horometroInicial) {
      throw horometroFueraDeRango(`No puede ser menor que el horómetro con que partió el turno (${turno.horometroInicial} h)`);
    }
    // Un turno siguiente con un inicial menor que este ya tiene un error de tipeo: no sirve como máximo
    const maximo = turno.horometroSiguiente !== null && turno.horometroSiguiente >= turno.horometroInicial ? turno.horometroSiguiente : null;
    if (maximo !== null && horometro > maximo) {
      throw horometroFueraDeRango(`No puede ser mayor que el horómetro con que partió el turno siguiente de la máquina (${maximo} h)`);
    }

    const guardado = await this.regularizacionRepo.regularizar({
      idTurno,
      idAlerta,
      idUsuario: autor.idUsuario,
      horometroFinal: horometro,
      comentarioAtencion: `Horómetro final regularizado: ${horometro} h${comentario ? `. ${comentario}` : ''}`,
      observacion: comentario || null,
      idCliente: uuid,
      fecha,
    });
    if (!guardado) {
      // Otro lo informó entremedio, o es este mismo reintento que llegó dos veces a la vez
      const actual = await this.regularizacionRepo.turnoCerradoAutomaticamente(idTurno);
      if (uuid && actual?.horometroFinal != null && (await this.regularizacionRepo.existeIdCliente(uuid))) {
        return { idAlerta, atenciones: await this.atencionRepo.listar(idAlerta), horometroFinal: actual.horometroFinal };
      }
      throw alertaError('HOROMETRO_YA_INFORMADO');
    }

    const atenciones = await this.atencionRepo.listar(idAlerta);
    this.publicador.publicarAtencion({ idAlerta, atenciones, horometroFinal: horometro });
    this.logger.log(`Usuario ${autor.idUsuario} regularizó el horómetro del turno ${idTurno}: ${horometro}`);
    return { idAlerta, atenciones, horometroFinal: horometro };
  }
}
