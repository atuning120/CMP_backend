import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/guards/roles.guard';
import { Roles, TODOS_LOS_ROLES } from '../../../../auth/interface/http/decorators/roles.decorator';
import { ListarAreasActivasUseCase } from '../../../application/use-cases/listar-areas-activas.use-case';
import { ListarZonasActivasUseCase } from '../../../application/use-cases/listar-zonas-activas.use-case';

@Controller('areas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TODOS_LOS_ROLES)
export class AreaController {
  constructor(
    private readonly listarAreasActivasUseCase: ListarAreasActivasUseCase,
    private readonly listarZonasActivasUseCase: ListarZonasActivasUseCase,
  ) {}

  @Get()
  async listarActivas() {
    return this.listarAreasActivasUseCase.execute();
  }

  @Get(':idArea/zonas')
  async listarZonas(@Param('idArea', ParseIntPipe) idArea: number) {
    return this.listarZonasActivasUseCase.execute(idArea);
  }
}
