import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ListarAlertasUseCase } from '../../../application/use-cases/listar-alertas.use-case';

// Pestaña Alertas del jefe de turno: turnos de más de 10 h y cierres automáticos, del más reciente al más antiguo
@Controller('alertas')
@UseGuards(JwtAuthGuard)
export class AlertasController {
  constructor(private readonly listarAlertasUseCase: ListarAlertasUseCase) {}

  // ?tipo=TODO|EXTENDIDOS|CIERRES_AUTOMATICOS&desde=<ISO>&hasta=<ISO>&antes=<fecha ISO de la última>&antesId=<su id>&limite=30
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
    return this.listarAlertasUseCase.execute({ rol: user?.rol, tipo, desde, hasta, antes, antesId, limite });
  }
}
