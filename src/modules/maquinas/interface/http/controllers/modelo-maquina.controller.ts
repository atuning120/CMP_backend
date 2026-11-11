import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/guards/roles.guard';
import { Roles, TODOS_LOS_ROLES } from '../../../../auth/interface/http/decorators/roles.decorator';
import { ListarModelosMaquinaUseCase } from '../../../application/use-cases/listar-modelos-maquina.use-case';

// Modelos genéricos con que la app pre-carga marca, modelo y tipo al incorporar una máquina
@Controller('modelos-maquina')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TODOS_LOS_ROLES)
export class ModeloMaquinaController {
  constructor(private readonly listarModelosMaquinaUseCase: ListarModelosMaquinaUseCase) {}

  @Get()
  async listar() {
    return this.listarModelosMaquinaUseCase.execute();
  }
}
