import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ListarHistorialUseCase } from '../../../application/use-cases/listar-historial.use-case';

// Pestaña Historial del jefe de turno: acciones sobre la flota e inicios de turno, del más reciente al más antiguo
@Controller('historial')
@UseGuards(JwtAuthGuard)
export class HistorialController {
  constructor(private readonly listarHistorialUseCase: ListarHistorialUseCase) {}

  // ?tipo=TODO|TURNOS|FLOTA&desde=<ISO>&hasta=<ISO>&antes=<fecha ISO del último evento>&antesId=<su id>&limite=30
  @Get()
  async listar(
    @CurrentUser() user: { rol: string },
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('antes') antes?: string,
    @Query('antesId') antesId?: string,
    @Query('limite') limite?: string,
  ) {
    return this.listarHistorialUseCase.execute({ rol: user?.rol, tipo, desde, hasta, antes, antesId, limite });
  }
}
