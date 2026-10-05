import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { ListarAreasActivasUseCase } from '../../../application/use-cases/listar-areas-activas.use-case';
import { ListarZonasActivasUseCase } from '../../../application/use-cases/listar-zonas-activas.use-case';

@Controller('areas')
@UseGuards(JwtAuthGuard)
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
