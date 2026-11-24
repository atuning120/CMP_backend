import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../../auth/interface/http/decorators/roles.decorator';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ListarGpsUseCase } from '../../../application/use-cases/listar-gps.use-case';
import { RegistrarGpsUseCase } from '../../../application/use-cases/registrar-gps.use-case';
import { EditarGpsUseCase } from '../../../application/use-cases/editar-gps.use-case';
import { CambiarAsignacionGpsUseCase } from '../../../application/use-cases/cambiar-asignacion-gps.use-case';
import { AsignarGpsRequestDto, DesvincularGpsRequestDto, EditarGpsRequestDto, RegistrarGpsRequestDto } from '../dtos/gps.request.dto';

type Usuario = { rol: string; idUsuario: number };

// GPS instalados en las máquinas (panel web: jefe de turno y administrador)
@Controller('gps')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('JEFE_TURNO', 'ADMIN')
export class GpsController {
  constructor(
    private readonly listarUseCase: ListarGpsUseCase,
    private readonly registrarUseCase: RegistrarGpsUseCase,
    private readonly editarUseCase: EditarGpsUseCase,
    private readonly asignacionUseCase: CambiarAsignacionGpsUseCase,
  ) {}

  @Get()
  async listar(@CurrentUser() user: Usuario) {
    return this.listarUseCase.execute(user ?? {});
  }

  // Máquinas en que estuvo el GPS, la más reciente primero
  @Get(':idGps/asignaciones')
  async historial(@Param('idGps', ParseIntPipe) idGps: number, @CurrentUser() user: Usuario) {
    return this.listarUseCase.historial(user ?? {}, idGps);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async registrar(@Body() body: RegistrarGpsRequestDto, @CurrentUser() user: Usuario) {
    return this.registrarUseCase.execute(user ?? {}, body ?? {});
  }

  // Modelo, SIM, baja o reactivación
  @Patch(':idGps')
  async editar(@Param('idGps', ParseIntPipe) idGps: number, @Body() body: EditarGpsRequestDto, @CurrentUser() user: Usuario) {
    return this.editarUseCase.execute(user ?? {}, idGps, body ?? {});
  }

  // Vincula el GPS a una máquina o lo mueve desde la que estaba
  @Post(':idGps/asignacion')
  @HttpCode(HttpStatus.OK)
  async asignar(@Param('idGps', ParseIntPipe) idGps: number, @Body() body: AsignarGpsRequestDto, @CurrentUser() user: Usuario) {
    return this.asignacionUseCase.asignar(user ?? {}, idGps, body ?? {});
  }

  @Post(':idGps/desvinculacion')
  @HttpCode(HttpStatus.OK)
  async desvincular(@Param('idGps', ParseIntPipe) idGps: number, @Body() body: DesvincularGpsRequestDto, @CurrentUser() user: Usuario) {
    return this.asignacionUseCase.desvincular(user ?? {}, idGps, body ?? {});
  }
}
