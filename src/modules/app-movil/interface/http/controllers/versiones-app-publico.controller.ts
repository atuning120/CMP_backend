import { Controller, Get, Header, Param, ParseIntPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ListarVersionesUseCase } from '../../../application/use-cases/listar-versiones.use-case';
import { ObtenerDescargaUseCase } from '../../../application/use-cases/obtener-descarga.use-case';

/**
 * Página pública de descarga de la app (sin sesión): historial de versiones publicadas y descarga. La descarga redirige
 * a un enlace firmado de 10 minutos, así los enlaces de la página y el QR siempre sirven y el archivo sigue privado.
 */
@Controller('app-movil')
export class VersionesAppPublicoController {
  constructor(
    private readonly listarVersionesUseCase: ListarVersionesUseCase,
    private readonly obtenerDescargaUseCase: ObtenerDescargaUseCase,
  ) {}

  // [{ idVersion, version, notas, tamanoBytes, subidaEn }], de la más alta a la más baja
  @Get('versiones')
  async versiones() {
    return (await this.listarVersionesUseCase.publicas()).map((v) => ({ ...v, subidaEn: v.subidaEn.toISOString() }));
  }

  // La versión más alta publicada (enlace fijo para el QR y para avisar de actualizaciones desde la app)
  @Get('descarga')
  @Header('Cache-Control', 'no-store')
  async descargarUltima(@Res() res: Response) {
    res.redirect(302, await this.obtenerDescargaUseCase.execute('ultima'));
  }

  @Get('versiones/:idVersion/descarga')
  @Header('Cache-Control', 'no-store')
  async descargar(@Param('idVersion', ParseIntPipe) idVersion: number, @Res() res: Response) {
    res.redirect(302, await this.obtenerDescargaUseCase.execute(idVersion));
  }
}
