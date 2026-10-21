import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { ApiKeyAdaptadorGuard } from '../../../infrastructure/guards/api-key-adaptador.guard';
import { RegistrarPosicionesUseCase } from '../../../application/use-cases/registrar-posiciones.use-case';
import { ObtenerUltimasPosicionesUseCase } from '../../../application/use-cases/obtener-ultimas-posiciones.use-case';
import type { RegistrarPosicionesRequestDto } from '../dtos/registrar-posiciones.request.dto';

@Controller('tracking')
export class TrackingController {
  constructor(
    private readonly registrarUseCase: RegistrarPosicionesUseCase,
    private readonly ultimasUseCase: ObtenerUltimasPosicionesUseCase,
  ) {}

  // Lo llama el adaptador (no un usuario): { posiciones: [...] } -> { recibidas, guardadas, descartadas }
  @Post('posiciones')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyAdaptadorGuard)
  async registrar(@Body() body: RegistrarPosicionesRequestDto) {
    return this.registrarUseCase.execute(body?.posiciones);
  }

  // Última posición GPS de cada máquina (mapa del panel web)
  @Get('ultimas')
  @UseGuards(JwtAuthGuard)
  async ultimas() {
    return this.ultimasUseCase.execute();
  }
}
