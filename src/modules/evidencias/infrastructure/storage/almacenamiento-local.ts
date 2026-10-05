import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { AlmacenamientoArchivosPort } from '../../domain/ports/almacenamiento-archivos.port';

/**
 * Guarda las fotos en disco, bajo EVIDENCIAS_DIR (por defecto ./storage/evidencias).
 * Adecuado para desarrollo o un servidor único; en producción conviene un almacenamiento de objetos.
 */
@Injectable()
export class AlmacenamientoLocal implements AlmacenamientoArchivosPort {
  private readonly base: string;

  constructor(config: ConfigService) {
    this.base = resolve(config.get<string>('EVIDENCIAS_DIR', 'storage/evidencias'));
  }

  async guardar(clave: string, contenido: Buffer, _mimeType: string): Promise<void> {
    const ruta = this.ruta(clave);
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, contenido);
  }

  async leer(clave: string): Promise<Buffer | null> {
    try {
      return await readFile(this.ruta(clave));
    } catch {
      return null;
    }
  }

  // Impide que una clave salga del directorio base (p. ej. "../../etc/passwd")
  private ruta(clave: string): string {
    const ruta = resolve(this.base, clave);
    if (!ruta.startsWith(this.base + sep)) {
      throw new Error('Clave de archivo inválida');
    }
    return ruta;
  }
}
