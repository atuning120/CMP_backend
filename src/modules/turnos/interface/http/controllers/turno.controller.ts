import { Controller, Get, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { IniciarTurnoUseCase } from '../../../application/use-cases/iniciar-turno.use-case';
import { FinalizarTurnoUseCase } from '../../../application/use-cases/finalizar-turno.use-case';
import { ObtenerTurnoActualUseCase } from '../../../application/use-cases/obtener-turno-actual.use-case';
import { RegistrarEstadoUseCase } from '../../../application/use-cases/registrar-estado.use-case';
import { IniciarTurnoRequestDto } from '../dtos/iniciar-turno.request.dto';
import { FinalizarTurnoRequestDto } from '../dtos/finalizar-turno.request.dto';
import { RegistrarEstadoRequestDto } from '../dtos/registrar-estado.request.dto';
import { presentTurnoActual, presentTurnoCerrado, presentTurnoEstado } from '../presenters/turno.presenter';
import { idOperadorDe, numeroOpcional } from './usuario-autenticado';
import type { UsuarioAutenticado } from './usuario-autenticado';

@Controller('turnos')
@UseGuards(JwtAuthGuard)
export class TurnoController {
  constructor(
    private readonly iniciarTurnoUseCase: IniciarTurnoUseCase,
    private readonly finalizarTurnoUseCase: FinalizarTurnoUseCase,
    private readonly obtenerTurnoActualUseCase: ObtenerTurnoActualUseCase,
    private readonly registrarEstadoUseCase: RegistrarEstadoUseCase,
  ) { }

  @Get('actual')
  async actual(@CurrentUser() user: UsuarioAutenticado) {
    const result = await this.obtenerTurnoActualUseCase.execute(idOperadorDe(user));
    return presentTurnoActual(result);
  }

  @Post('iniciar')
  @HttpCode(HttpStatus.CREATED)
  async iniciar(
    @Body() body: IniciarTurnoRequestDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    const result = await this.iniciarTurnoUseCase.execute({
      idOperador: idOperadorDe(user),
      idMaquina: Number(body.idMaquina),
      horometroInicial: Number(body.horometroInicial),
      idArea: Number(body.idArea),
      idZona: numeroOpcional(body.idZona),
      idCliente: body.idCliente,
      fechaInicio: body.fechaInicio,
    });
    return presentTurnoActual(result);
  }

  @Post('finalizar')
  @HttpCode(HttpStatus.OK)
  async finalizar(
    @Body() body: FinalizarTurnoRequestDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    const turno = await this.finalizarTurnoUseCase.execute({
      idOperador: idOperadorDe(user),
      idTurno: numeroOpcional(body.idTurno),
      idClienteTurno: body.idClienteTurno,
      horometroFinal: Number(body.horometroFinal),
      fechaFin: body.fechaFin,
    });
    return presentTurnoCerrado(turno);
  }

  @Post('estados')
  @HttpCode(HttpStatus.CREATED)
  async registrarEstado(
    @Body() body: RegistrarEstadoRequestDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    const registro = await this.registrarEstadoUseCase.execute({
      idOperador: idOperadorDe(user),
      idTurno: numeroOpcional(body.idTurno),
      idClienteTurno: body.idClienteTurno,
      idCliente: body.idCliente,
      idEstado: Number(body.idEstado),
      inicio: body.inicio,
      comentario: body.comentario,
    });
    return presentTurnoEstado(registro);
  }
}
