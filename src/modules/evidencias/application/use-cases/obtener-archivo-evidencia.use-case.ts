import { Injectable, Inject } from '@nestjs/common';
import { EVIDENCIA_REPOSITORY } from '../../domain/repositories/evidencia.repository.port';
import type { EvidenciaRepositoryPort } from '../../domain/repositories/evidencia.repository.port';
import { REPORTE_REPOSITORY } from '../../domain/repositories/reporte.repository.port';
import type { ReporteRepositoryPort } from '../../domain/repositories/reporte.repository.port';
import { ALMACENAMIENTO_ARCHIVOS } from '../../domain/ports/almacenamiento-archivos.port';
import type { AlmacenamientoArchivosPort } from '../../domain/ports/almacenamiento-archivos.port';
import { TURNO_REPOSITORY } from '../../../turnos/domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../../turnos/domain/repositories/turno.repository.port';
import { validarIdCliente } from '../../../turnos/application/datos-cliente';
import { evidenciaError } from '../evidencia.errors';
import { EXTENSIONES_IMAGEN } from './subir-evidencia.use-case';

const MIME_POR_EXTENSION = Object.fromEntries(Object.entries(EXTENSIONES_IMAGEN).map(([mime, ext]) => [ext, mime]));

@Injectable()
export class ObtenerArchivoEvidenciaUseCase {
  constructor(
    @Inject(EVIDENCIA_REPOSITORY)
    private readonly evidenciaRepo: EvidenciaRepositoryPort,
    @Inject(REPORTE_REPOSITORY)
    private readonly reporteRepo: ReporteRepositoryPort,
    @Inject(TURNO_REPOSITORY)
    private readonly turnoRepo: TurnoRepositoryPort,
    @Inject(ALMACENAMIENTO_ARCHIVOS)
    private readonly almacenamiento: AlmacenamientoArchivosPort,
  ) {}

  // Jefe de turno ve cualquier evidencia; un operador solo las de sus turnos
  async execute(idClienteEvidencia: string, usuario: { rol: string; idOperador?: number }): Promise<{ contenido: Buffer; mimeType: string }> {
    const idCliente = validarIdCliente(idClienteEvidencia);
    const evidencia = idCliente ? await this.evidenciaRepo.findByIdCliente(idCliente) : null;
    if (!evidencia) throw evidenciaError('EVIDENCIA_NO_ENCONTRADA');

    if (usuario.rol !== 'JEFE_TURNO') {
      const reporte = await this.reporteRepo.findById(evidencia.idReporte);
      const turno = reporte ? await this.turnoRepo.findById(reporte.idTurno) : null;
      if (!turno || turno.idOperador !== usuario.idOperador) {
        throw evidenciaError('EVIDENCIA_NO_ENCONTRADA');
      }
    }

    const contenido = await this.almacenamiento.leer(evidencia.claveArchivo);
    if (!contenido) throw evidenciaError('EVIDENCIA_NO_ENCONTRADA');
    const extension = evidencia.claveArchivo.split('.').pop() ?? '';
    return { contenido, mimeType: MIME_POR_EXTENSION[extension] ?? 'application/octet-stream' };
  }
}
