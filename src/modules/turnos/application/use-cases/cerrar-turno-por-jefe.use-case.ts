import { Inject, Injectable } from '@nestjs/common';
import { Turno } from '../../domain/entities/turno.entity';
import { TURNO_REPOSITORY } from '../../domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../domain/repositories/turno.repository.port';
import { fechaDelEvento, validarIdCliente } from '../datos-cliente';
import { turnoError, turnoYaCerrado } from '../turno.errors';
import { accionVencida } from '../../../../shared/application/vigencia-accion';

const ROLES_CIERRE = ['JEFE_TURNO', 'ADMIN'];
const LARGO_MAXIMO_MOTIVO = 100;

export interface CerrarTurnoPorJefeDto {
  rol: string;
  idUsuario?: number;
  idMaquina: unknown;
  horometroFinal: unknown;
  motivo: unknown;
  // El turno que vio el jefe de turno (la app lo envía). Sin él se cierra el que esté en curso en la máquina
  idTurno?: unknown;
  idCliente?: unknown; // UUID del cierre: un reintento cuya respuesta no llegó no lo repite
  fechaAccion?: unknown; // cuándo lo cerró (tomó el horómetro), si lo hizo sin señal y se envía después
}

/**
 * El jefe de turno cierra el turno en curso de una máquina en nombre del operador, para poder sacarla de
 * operación (falla, mantención) o reemplazarla. Pide el horómetro final: un cierre sin él dejaría las horas de la
 * máquina sin justificar. La app del operador se entera al sincronizar y le muestra quién lo cerró y por qué.
 *
 * Desde la app se puede hacer sin señal: se cierra el turno que el jefe vio (no otro que haya empezado después) y gana
 * el primer cierre que llega al servidor. Si el operador, otro jefe o el sistema lo cerraron antes, responde
 * TURNO_YA_CERRADO con quién y a qué hora.
 */
@Injectable()
export class CerrarTurnoPorJefeUseCase {
  constructor(
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
  ) {}

  async execute(dto: CerrarTurnoPorJefeDto, ahora: Date = new Date()): Promise<Turno> {
    if (!ROLES_CIERRE.includes(dto.rol) || !dto.idUsuario) throw turnoError('SIN_PERMISO_CIERRE');

    const motivo = typeof dto.motivo === 'string' ? dto.motivo.trim() : '';
    if (!motivo || motivo.length > LARGO_MAXIMO_MOTIVO) throw turnoError('MOTIVO_INVALIDO');

    if (dto.idCliente != null && typeof dto.idCliente !== 'string') throw turnoError('ID_CLIENTE_INVALIDO');
    const idCliente = validarIdCliente(dto.idCliente);
    // Reintento de un cierre ya guardado: se responde con el turno como quedó
    const yaGuardado = idCliente ? await this.turnoRepo.findByIdClienteCierre(idCliente) : null;
    if (yaGuardado) return yaGuardado;
    if (dto.fechaAccion != null && typeof dto.fechaAccion !== 'string') throw turnoError('FECHA_INVALIDA');
    const fecha = fechaDelEvento(dto.fechaAccion, ahora);
    // Hecho sin señal hace más de 72 h: ya no se aplica (la app lo descarta antes; esto es el respaldo)
    if (dto.fechaAccion != null && accionVencida(fecha, ahora)) throw turnoError('ACCION_VENCIDA');

    const turno = await this.turnoACerrar(dto, ahora);

    const horometro = typeof dto.horometroFinal === 'number' ? dto.horometroFinal : Number.NaN;
    if (!Number.isFinite(horometro) || horometro < turno.horometroInicial) throw turnoError('HOROMETRO_INVALIDO');

    // Sin señal, el término es cuando tomó el horómetro, pero no antes de lo último que registró el operador
    const ultimo = await this.turnoRepo.findUltimoRegistro(turno.id!);
    const fin = new Date(Math.max(fecha.getTime(), turno.fechaInicio.getTime(), ultimo?.getTime() ?? 0));
    turno.cerrarPorJefe(fin, horometro, dto.idUsuario, motivo);
    // El operador u otro jefe de turno lo cerró mientras tanto: gana el primer cierre
    const cerrado = await this.turnoRepo.cerrar(turno, false, idCliente);
    if (cerrado) return cerrado;
    // Dos reintentos simultáneos del mismo cierre: el segundo responde con el primero
    const mismo = idCliente ? await this.turnoRepo.findByIdClienteCierre(idCliente) : null;
    if (mismo) return mismo;
    throw await this.yaCerrado(turno.id!, ahora);
  }

  private async turnoACerrar(dto: CerrarTurnoPorJefeDto, ahora: Date): Promise<Turno> {
    const idMaquina = Number(dto.idMaquina);
    if (!Number.isInteger(idMaquina) || idMaquina <= 0) throw turnoError('SIN_TURNO_EN_CURSO');
    if (dto.idTurno === undefined || dto.idTurno === null) {
      const activo = await this.turnoRepo.findActivoByMaquina(idMaquina);
      if (!activo) throw turnoError('SIN_TURNO_EN_CURSO');
      return activo;
    }
    const idTurno = Number(dto.idTurno);
    const turno = Number.isInteger(idTurno) && idTurno > 0 ? await this.turnoRepo.findById(idTurno) : null;
    if (!turno || turno.idMaquina !== idMaquina) throw turnoError('TURNO_NO_ENCONTRADO');
    if (!turno.enCurso) throw await this.yaCerrado(idTurno, ahora);
    return turno;
  }

  private async yaCerrado(idTurno: number, ahora: Date) {
    const cierre = await this.turnoRepo.findCierre(idTurno);
    return cierre ? turnoYaCerrado(cierre.por, cierre.fecha, ahora) : turnoError('SIN_TURNO_EN_CURSO');
  }
}
