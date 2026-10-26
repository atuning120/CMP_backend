import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ListarUsuariosUseCase } from '../../../application/use-cases/listar-usuarios.use-case';
import { CambiarRolUsuarioUseCase } from '../../../application/use-cases/cambiar-rol-usuario.use-case';
import { CrearUsuarioUseCase } from '../../../application/use-cases/crear-usuario.use-case';
import { CambiarEstadoUsuarioUseCase } from '../../../application/use-cases/cambiar-estado-usuario.use-case';
import { EditarUsuarioUseCase } from '../../../application/use-cases/editar-usuario.use-case';
import { CambiarRolUsuarioRequestDto } from '../dtos/cambiar-rol-usuario.request.dto';
import { CrearUsuarioRequestDto } from '../dtos/crear-usuario.request.dto';
import { CambiarEstadoUsuarioRequestDto } from '../dtos/cambiar-estado-usuario.request.dto';
import { EditarUsuarioRequestDto } from '../dtos/editar-usuario.request.dto';

// Administración de usuarios del panel web (solo ADMIN)
@Controller('usuarios')
@UseGuards(JwtAuthGuard)
export class UsuarioController {
  constructor(
    private readonly listarUsuariosUseCase: ListarUsuariosUseCase,
    private readonly cambiarRolUsuarioUseCase: CambiarRolUsuarioUseCase,
    private readonly crearUsuarioUseCase: CrearUsuarioUseCase,
    private readonly cambiarEstadoUsuarioUseCase: CambiarEstadoUsuarioUseCase,
    private readonly editarUsuarioUseCase: EditarUsuarioUseCase,
  ) {}

  @Get()
  async listar(@CurrentUser() user: { rol: string }) {
    return this.listarUsuariosUseCase.execute(user?.rol);
  }

  // Alta de usuarios web y de operadores de la app móvil; responde el usuario creado
  @Post()
  async crear(@Body() body: CrearUsuarioRequestDto, @CurrentUser() user: { idUsuario: number; rol: string }) {
    return this.crearUsuarioUseCase.execute({ datos: body ?? {}, autor: user });
  }

  // Datos personales y forma de entrar (incluye restablecer la contraseña); responde el usuario actualizado
  @Patch(':idUsuario')
  async editar(
    @Param('idUsuario', ParseIntPipe) idUsuario: number,
    @Body() body: EditarUsuarioRequestDto,
    @CurrentUser() user: { idUsuario: number; rol: string },
  ) {
    return this.editarUsuarioUseCase.execute({ idUsuario, datos: body ?? {}, autor: user });
  }

  @Patch(':idUsuario/activo')
  async cambiarEstado(
    @Param('idUsuario', ParseIntPipe) idUsuario: number,
    @Body() body: CambiarEstadoUsuarioRequestDto,
    @CurrentUser() user: { idUsuario: number; rol: string },
  ) {
    return this.cambiarEstadoUsuarioUseCase.execute({ idUsuario, activo: body?.activo, autor: user });
  }

  @Patch(':idUsuario/rol')
  async cambiarRol(
    @Param('idUsuario', ParseIntPipe) idUsuario: number,
    @Body() body: CambiarRolUsuarioRequestDto,
    @CurrentUser() user: { idUsuario: number; rol: string },
  ) {
    return this.cambiarRolUsuarioUseCase.execute({ idUsuario, rol: body?.rol, autor: user });
  }
}
