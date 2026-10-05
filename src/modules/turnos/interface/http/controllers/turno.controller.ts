import { Controller, Get, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { IniciarTurnoUseCase } from '../../../application/use-cases/iniciar-turno.use-case';
import { FinalizarTurnoUseCase } from '../../../application/use-cases/finalizar-turno.use-case';
import { ObtenerTurnoActualUseCase } from '../../../application/use-cases/obtener-turno-actual.use-case';
import { turnoError } from '../../../application/turno.errors';
import { IniciarTurnoRequestDto } from '../dtos/iniciar-turno.request.dto';
import { FinalizarTurnoRequestDto } from '../dtos/finalizar-turno.request.dto';
import { presentTurnoActual, presentTurnoCerrado } from '../presenters/turno.presenter';

interface UsuarioAutenticado {
  idUsuario: number;
  rol: string;
  idOperador?: number;
}

// El operador sale siempre del JWT: el turno pertenece a la persona, no a la sesión,
// por lo que cerrar sesión no lo cierra y al volver a ingresar se recupera con GET /turnos/actual.
const idOperadorDe = (user: UsuarioAutenticado): number => {
  if (!user?.idOperador) {
    throw turnoError('SIN_OPERADOR');
  }
  return user.idOperador;
};

@Controller('turnos')
@UseGuards(JwtAuthGuard)
export class TurnoController {
  constructor(
    private readonly iniciarTurnoUseCase: IniciarTurnoUseCase,
    private readonly finalizarTurnoUseCase: FinalizarTurnoUseCase,
    private readonly obtenerTurnoActualUseCase: ObtenerTurnoActualUseCase,
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
      idZona: body.idZona === undefined || body.idZona === null ? null : Number(body.idZona),
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
      idTurno: Number(body.idTurno),
      horometroFinal: Number(body.horometroFinal),
    });
    return presentTurnoCerrado(turno);
  }
}
