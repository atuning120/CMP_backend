import { Inject, Injectable } from '@nestjs/common';
import { MAQUINA_REPOSITORY } from '../../domain/repositories/maquina.repository.port';
import type { AccionBitacora, MaquinaFlota, MaquinaRepositoryPort } from '../../domain/repositories/maquina.repository.port';
import { maquinaError } from '../maquina.errors';
import { guardarSinPisar, ROLES_GESTION_FLOTA, texto, verificarVersionBase } from '../maquina.datos';

export interface DevolverMaquinaDto {
  rol: string;
  idUsuario?: number;
  idMaquina: unknown; // la original, la que vuelve a operar
  motivo?: unknown;
  observacion?: unknown;
  versionBase?: unknown; // versión de la original que vio el jefe de turno
}

export interface ResultadoDevolucion {
  original: MaquinaFlota;
  respaldo: MaquinaFlota;
}

/**
 * Deshace un reemplazo cuando la máquina original vuelve de la reparación: la original queda operativa con el
 * operador que tenía el respaldo, y el respaldo vuelve al estado que tenía antes (normalmente "en reserva").
 * Si el respaldo tiene un turno en curso, primero hay que cerrarlo (con su horómetro final).
 */
@Injectable()
export class DevolverMaquinaUseCase {
  constructor(
    @Inject(MAQUINA_REPOSITORY)
    private readonly maquinaRepo: MaquinaRepositoryPort,
  ) {}

  async execute(dto: DevolverMaquinaDto): Promise<ResultadoDevolucion> {
    if (!ROLES_GESTION_FLOTA.includes(dto.rol) || !dto.idUsuario) throw maquinaError('SIN_PERMISO');

    const id = Number(dto.idMaquina);
    const original = Number.isInteger(id) && id > 0 ? await this.maquinaRepo.findFlotaById(id) : null;
    if (!original) throw maquinaError('MAQUINA_NO_ENCONTRADA');
    verificarVersionBase(original, dto.versionBase);
    if (!original.respaldo) throw maquinaError('SIN_RESPALDO');

    const motivo = texto('motivo', dto.motivo);
    if (!motivo) throw maquinaError('DATOS_INVALIDOS', 'El motivo de la devolución es obligatorio');
    const observacion = texto('observacion', dto.observacion);

    const respaldo = await this.maquinaRepo.findFlotaById(original.respaldo.idMaquina);
    if (!respaldo) throw maquinaError('MAQUINA_NO_ENCONTRADA');
    if (await this.maquinaRepo.tieneTurnoEnCurso(respaldo.idMaquina)) throw maquinaError('MAQUINA_EN_USO', respaldo.nombre);

    const estadoRespaldo = original.respaldo.estadoAlDevolver;
    const operador = respaldo.operadorAsignado;
    const registro = { idUsuario: dto.idUsuario, motivo, observacion };

    const accionesOriginal: AccionBitacora[] = [
      {
        ...registro,
        accion: 'DEVOLVER',
        detalle: {
          respaldo: respaldo.nombre,
          operador: operador?.nombre ?? null,
          antes: { estado: original.estado },
          despues: { estado: 'ACTIVA' },
        },
      },
    ];
    const accionesRespaldo: AccionBitacora[] = [];
    if (respaldo.estado !== estadoRespaldo) {
      accionesRespaldo.push({
        ...registro,
        accion: estadoRespaldo === 'BAJA' ? 'DESHABILITAR' : respaldo.estado === 'BAJA' ? 'HABILITAR' : 'CAMBIAR_ESTADO',
        detalle: { devueltaA: original.nombre, antes: { estado: respaldo.estado }, despues: { estado: estadoRespaldo } },
      });
    }
    if (operador) {
      accionesRespaldo.push({
        ...registro,
        accion: 'EDITAR',
        observacion: `${operador.nombre} volvió a ${original.nombre}`,
        detalle: { antes: { operador: operador.nombre }, despues: { operador: null } },
      });
    }

    await guardarSinPisar(this.maquinaRepo, () =>
      this.maquinaRepo.devolver({
        idOriginal: original.idMaquina,
        idRespaldo: respaldo.idMaquina,
        estadoRespaldo,
        idOperador: operador?.idOperador ?? null,
        versiones: [
          { idMaquina: original.idMaquina, version: original.version },
          { idMaquina: respaldo.idMaquina, version: respaldo.version },
        ],
        accionesOriginal,
        accionesRespaldo,
      }),
    );

    const [originalFinal, respaldoFinal] = await Promise.all([
      this.maquinaRepo.findFlotaById(original.idMaquina),
      this.maquinaRepo.findFlotaById(respaldo.idMaquina),
    ]);
    if (!originalFinal || !respaldoFinal) throw new Error('No se encontraron las máquinas después de la devolución');
    return { original: originalFinal, respaldo: respaldoFinal };
  }
}
