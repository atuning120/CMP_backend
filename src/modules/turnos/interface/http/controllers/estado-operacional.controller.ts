import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/guards/roles.guard';
import { Roles, TODOS_LOS_ROLES } from '../../../../auth/interface/http/decorators/roles.decorator';
import { ListarEstadosOperacionalesUseCase } from '../../../application/use-cases/listar-estados-operacionales.use-case';

@Controller('estados-operacionales')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TODOS_LOS_ROLES)
export class EstadoOperacionalController {
  constructor(private readonly listarEstadosOperacionalesUseCase: ListarEstadosOperacionalesUseCase) {}

  @Get()
  async listarActivos() {
    return this.listarEstadosOperacionalesUseCase.execute();
  }
}
