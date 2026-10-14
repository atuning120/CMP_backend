import { Body, Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ListarUsuariosUseCase } from '../../../application/use-cases/listar-usuarios.use-case';
import { CambiarRolUsuarioUseCase } from '../../../application/use-cases/cambiar-rol-usuario.use-case';
import { CambiarRolUsuarioRequestDto } from '../dtos/cambiar-rol-usuario.request.dto';

// Administración de usuarios del panel web (solo ADMIN)
@Controller('usuarios')
@UseGuards(JwtAuthGuard)
export class UsuarioController {
  constructor(
    private readonly listarUsuariosUseCase: ListarUsuariosUseCase,
    private readonly cambiarRolUsuarioUseCase: CambiarRolUsuarioUseCase,
  ) {}

  @Get()
  async listar(@CurrentUser() user: { rol: string }) {
    return this.listarUsuariosUseCase.execute(user?.rol);
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
