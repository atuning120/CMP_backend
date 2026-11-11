import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/guards/roles.guard';
import { Roles, TODOS_LOS_ROLES } from '../../../../auth/interface/http/decorators/roles.decorator';
import { ListarZonasActivasUseCase } from '../../../application/use-cases/listar-zonas-activas.use-case';

@Controller('zonas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TODOS_LOS_ROLES)
export class ZonaController {
  constructor(private readonly listarZonasActivasUseCase: ListarZonasActivasUseCase) {}

  @Get()
  async listarActivas() {
    return this.listarZonasActivasUseCase.todas();
  }
}
