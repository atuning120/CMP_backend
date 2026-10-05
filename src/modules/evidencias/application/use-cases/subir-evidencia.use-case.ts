import { Injectable, Inject } from '@nestjs/common';
import { REPORTE_REPOSITORY } from '../../domain/repositories/reporte.repository.port';
import type { ReporteRepositoryPort } from '../../domain/repositories/reporte.repository.port';
import { EVIDENCIA_REPOSITORY } from '../../domain/repositories/evidencia.repository.port';
import type { EvidenciaRegistro, EvidenciaRepositoryPort } from '../../domain/repositories/evidencia.repository.port';
import { ALMACENAMIENTO_ARCHIVOS } from '../../domain/ports/almacenamiento-archivos.port';
import type { AlmacenamientoArchivosPort } from '../../domain/ports/almacenamiento-archivos.port';
import { TURNO_REPOSITORY } from '../../../turnos/domain/repositories/turno.repository.port';
import type { TurnoRepositoryPort } from '../../../turnos/domain/repositories/turno.repository.port';
import { fechaDelEvento, validarIdCliente } from '../../../turnos/application/datos-cliente';
import { turnoError } from '../../../turnos/application/turno.errors';
import { evidenciaError } from '../evidencia.errors';

export const TAMANO_MAXIMO_EVIDENCIA = 10 * 1024 * 1024;

export const EXTENSIONES_IMAGEN: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

// Algunos clientes (p. ej. expo/fetch con un File) envían application/octet-stream: se usa la extensión
const MIME_POR_EXTENSION: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };

export const mimeDeArchivo = (archivo: { mimetype: string; originalname?: string }): string => {
  if (EXTENSIONES_IMAGEN[archivo.mimetype]) return archivo.mimetype;
  const extension = archivo.originalname?.split('.').pop()?.toLowerCase() ?? '';
  return MIME_POR_EXTENSION[extension] ?? archivo.mimetype;
};

export interface SubirEvidenciaDto {
  idOperador: number;
  idCliente: string;
  idClienteReporte: string;
  fechaHora?: string | Date | null;
  archivo: { buffer: Buffer; mimetype: string; size: number; originalname?: string } | undefined;
}

@Injectable()
export class SubirEvidenciaUseCase {
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

  async execute(dto: SubirEvidenciaDto, ahora: Date = new Date()): Promise<EvidenciaRegistro> {
    const idCliente = validarIdCliente(dto.idCliente);
    const idClienteReporte = validarIdCliente(dto.idClienteReporte);
    if (!idCliente || !idClienteReporte) throw turnoError('ID_CLIENTE_INVALIDO');

    const reporte = await this.reporteRepo.findByIdCliente(idClienteReporte);
    const turno = reporte ? await this.turnoRepo.findById(reporte.idTurno) : null;
    if (!reporte || !turno || turno.idOperador !== dto.idOperador) throw evidenciaError('REPORTE_NO_ENCONTRADO');

    // Reintento de una subida ya completada (p. ej. se cortó la señal antes de recibir la respuesta)
    const existente = await this.evidenciaRepo.findByIdCliente(idCliente);
    if (existente) {
      if (existente.idReporte !== reporte.idReporte) throw turnoError('ID_CLIENTE_INVALIDO');
      return existente;
    }

    const extension = dto.archivo ? EXTENSIONES_IMAGEN[mimeDeArchivo(dto.archivo)] : undefined;
    if (!dto.archivo || !extension || dto.archivo.size === 0 || dto.archivo.size > TAMANO_MAXIMO_EVIDENCIA) {
      throw evidenciaError('ARCHIVO_INVALIDO');
    }

    const fechaHora = fechaDelEvento(dto.fechaHora, ahora);
    const clave = `turno-${turno.id}/${idCliente}.${extension}`;
    // Primero el archivo y luego el registro: si falla el registro, el reintento sobrescribe el mismo archivo
    await this.almacenamiento.guardar(clave, dto.archivo.buffer);
    return this.evidenciaRepo.create({ idReporte: reporte.idReporte, claveArchivo: clave, fechaHora, idCliente });
  }
}
