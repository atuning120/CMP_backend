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

// Marcas HEIF/HEIC que dejan las cámaras en la caja "ftyp" (bytes 8-11)
const MARCAS_HEIC = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

const empiezaCon = (buffer: Buffer, firma: number[], desde = 0) =>
  buffer.length >= desde + firma.length && firma.every((byte, i) => buffer[desde + i] === byte);
const textoEn = (buffer: Buffer, desde: number, largo: number) => buffer.subarray(desde, desde + largo).toString('latin1');

/**
 * Tipo de imagen según los primeros bytes del archivo, no según el mimetype o el nombre que declara el cliente
 * (ambos los controla quien sube). Así un HTML o un ejecutable renombrado a .jpg no se guarda como evidencia.
 * Devuelve null si el contenido no es una imagen aceptada.
 */
export const mimeDelContenido = (buffer: Buffer): string | null => {
  if (empiezaCon(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (empiezaCon(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (textoEn(buffer, 0, 4) === 'RIFF' && textoEn(buffer, 8, 4) === 'WEBP') return 'image/webp';
  if (textoEn(buffer, 4, 4) === 'ftyp' && MARCAS_HEIC.has(textoEn(buffer, 8, 4))) return 'image/heic';
  return null;
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

    const mime = dto.archivo ? mimeDelContenido(dto.archivo.buffer) : null;
    if (!dto.archivo || !mime || dto.archivo.size === 0 || dto.archivo.size > TAMANO_MAXIMO_EVIDENCIA) {
      throw evidenciaError('ARCHIVO_INVALIDO');
    }
    const extension = EXTENSIONES_IMAGEN[mime];

    const fechaHora = fechaDelEvento(dto.fechaHora, ahora);
    const clave = `turno-${turno.id}/${idCliente}.${extension}`;
    // Primero el archivo y luego el registro: si falla el registro, el reintento sobrescribe el mismo archivo
    await this.almacenamiento.guardar(clave, dto.archivo.buffer, mime);
    return this.evidenciaRepo.create({ idReporte: reporte.idReporte, claveArchivo: clave, fechaHora, idCliente });
  }
}
