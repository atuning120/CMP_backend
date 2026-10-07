import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { ListarModelosMaquinaUseCase } from '../../../application/use-cases/listar-modelos-maquina.use-case';

// Modelos genéricos con que la app pre-carga marca, modelo y tipo al incorporar una máquina
@Controller('modelos-maquina')
@UseGuards(JwtAuthGuard)
export class ModeloMaquinaController {
  constructor(private readonly listarModelosMaquinaUseCase: ListarModelosMaquinaUseCase) {}

  @Get()
  async listar() {
    return this.listarModelosMaquinaUseCase.execute();
  }
}
