import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/infrastructure/guards/roles.guard';
import { Roles, TODOS_LOS_ROLES } from '../../../../auth/interface/http/decorators/roles.decorator';
import { ApiKeyAdaptadorGuard } from '../../../infrastructure/guards/api-key-adaptador.guard';
import { RegistrarPosicionesUseCase } from '../../../application/use-cases/registrar-posiciones.use-case';
import { ObtenerUltimasPosicionesUseCase } from '../../../application/use-cases/obtener-ultimas-posiciones.use-case';
import { ObtenerRecorridoUseCase } from '../../../application/use-cases/obtener-recorrido.use-case';
import type { RegistrarPosicionesRequestDto } from '../dtos/registrar-posiciones.request.dto';

@Controller('tracking')
export class TrackingController {
  constructor(
    private readonly registrarUseCase: RegistrarPosicionesUseCase,
    private readonly ultimasUseCase: ObtenerUltimasPosicionesUseCase,
    private readonly recorridoUseCase: ObtenerRecorridoUseCase,
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TODOS_LOS_ROLES)
  async ultimas() {
    return this.ultimasUseCase.execute();
  }

  // Recorrido de una máquina en un rango (?desde=<ISO>&hasta=<ISO>, sin hasta = hasta ahora; máximo 48 h).
  // Los mismos roles que ven el mapa en vivo
  @Get('maquinas/:idMaquina/recorrido')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TODOS_LOS_ROLES)
  async recorridoDeMaquina(
    @Param('idMaquina', ParseIntPipe) idMaquina: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.recorridoUseCase.porMaquina(idMaquina, desde, hasta);
  }

  // Recorrido de la máquina durante un turno (en curso: hasta ahora)
  @Get('turnos/:idTurno/recorrido')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TODOS_LOS_ROLES)
  async recorridoDeTurno(@Param('idTurno', ParseIntPipe) idTurno: number) {
    return this.recorridoUseCase.porTurno(idTurno);
  }
}
