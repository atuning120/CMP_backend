import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../../auth/interface/http/decorators/roles.decorator';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../../../../turnos/interface/http/controllers/usuario-autenticado';
import type { VersionApp } from '../../../domain/repositories/version-app.repository.port';
import { ListarVersionesUseCase } from '../../../application/use-cases/listar-versiones.use-case';
import { PrepararSubidaUseCase } from '../../../application/use-cases/preparar-subida.use-case';
import { RegistrarVersionUseCase } from '../../../application/use-cases/registrar-version.use-case';
import { EditarVersionUseCase } from '../../../application/use-cases/editar-version.use-case';
import { EliminarVersionUseCase } from '../../../application/use-cases/eliminar-version.use-case';

// El nombre del blob no sale del Backend fuera del paso de subida
const presentar = ({ archivo: _archivo, ...v }: VersionApp) => ({ ...v, subidaEn: v.subidaEn.toISOString() });

/**
 * Administración de las versiones de la app (solo ADMIN). Publicar es en dos pasos: POST subida entrega un enlace para
 * subir la APK directo a Azure y POST versiones la registra cuando terminó de subir.
 */
@Controller('app-movil/admin/versiones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class VersionesAppAdminController {
  constructor(
    private readonly listarVersionesUseCase: ListarVersionesUseCase,
    private readonly prepararSubidaUseCase: PrepararSubidaUseCase,
    private readonly registrarVersionUseCase: RegistrarVersionUseCase,
    private readonly editarVersionUseCase: EditarVersionUseCase,
    private readonly eliminarVersionUseCase: EliminarVersionUseCase,
  ) {}

  // Todas, también las retiradas: [{ idVersion, version, notas, tamanoBytes, publicada, subidaEn, subidaPor }]
  @Get()
  async listar(@CurrentUser() user: UsuarioAutenticado) {
    return (await this.listarVersionesUseCase.todas(user?.rol)).map(presentar);
  }

  // { version, tamanoBytes } -> { archivo, urlSubida, expiraEn }
  @Post('subida')
  @HttpCode(HttpStatus.OK)
  async prepararSubida(@Body() body: { version?: unknown; tamanoBytes?: unknown }, @CurrentUser() user: UsuarioAutenticado) {
    const subida = await this.prepararSubidaUseCase.execute({ rol: user?.rol, version: body?.version, tamanoBytes: body?.tamanoBytes });
    return { ...subida, expiraEn: subida.expiraEn.toISOString() };
  }

  // { version, notas, archivo } con la APK ya subida
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async registrar(@Body() body: { version?: unknown; notas?: unknown; archivo?: unknown }, @CurrentUser() user: UsuarioAutenticado) {
    return presentar(
      await this.registrarVersionUseCase.execute({
        rol: user?.rol,
        idUsuario: user?.idUsuario,
        version: body?.version,
        notas: body?.notas,
        archivo: body?.archivo,
      }),
    );
  }

  // { notas?, publicada? }
  @Patch(':idVersion')
  async editar(
    @Param('idVersion', ParseIntPipe) idVersion: number,
    @Body() body: { notas?: unknown; publicada?: unknown },
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return presentar(await this.editarVersionUseCase.execute({ rol: user?.rol, idVersion, notas: body?.notas, publicada: body?.publicada }));
  }

  @Delete(':idVersion')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('idVersion', ParseIntPipe) idVersion: number, @CurrentUser() user: UsuarioAutenticado) {
    await this.eliminarVersionUseCase.execute({ rol: user?.rol, idVersion });
  }
}
