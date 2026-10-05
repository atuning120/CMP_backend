import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { ListarEstadosOperacionalesUseCase } from '../../../application/use-cases/listar-estados-operacionales.use-case';

@Controller('estados-operacionales')
@UseGuards(JwtAuthGuard)
export class EstadoOperacionalController {
  constructor(private readonly listarEstadosOperacionalesUseCase: ListarEstadosOperacionalesUseCase) {}

  @Get()
  async listarActivos() {
    return this.listarEstadosOperacionalesUseCase.execute();
  }
}
