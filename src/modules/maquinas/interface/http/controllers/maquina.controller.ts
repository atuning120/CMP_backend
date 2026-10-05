import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { ListarMaquinasActivasUseCase } from '../../../application/use-cases/listar-maquinas-activas.use-case';

@Controller('maquinas')
@UseGuards(JwtAuthGuard)
export class MaquinaController {
  constructor(private readonly listarMaquinasActivasUseCase: ListarMaquinasActivasUseCase) {}

  @Get()
  async listarActivas() {
    return this.listarMaquinasActivasUseCase.execute();
  }
}
