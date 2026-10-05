import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { ListarZonasActivasUseCase } from '../../../application/use-cases/listar-zonas-activas.use-case';

@Controller('zonas')
@UseGuards(JwtAuthGuard)
export class ZonaController {
  constructor(private readonly listarZonasActivasUseCase: ListarZonasActivasUseCase) {}

  @Get()
  async listarActivas() {
    return this.listarZonasActivasUseCase.todas();
  }
}
