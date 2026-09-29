import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { IniciarTurnoUseCase } from '../../../application/use-cases/iniciar-turno.use-case';
import { FinalizarTurnoUseCase } from '../../../application/use-cases/finalizar-turno.use-case';
import { IniciarTurnoRequestDto } from '../dtos/iniciar-turno.request.dto';
import { FinalizarTurnoRequestDto } from '../dtos/finalizar-turno.request.dto';

@Controller('turnos')
@UseGuards(JwtAuthGuard)
export class TurnoController {
  constructor(
    private readonly iniciarTurnoUseCase: IniciarTurnoUseCase,
    private readonly finalizarTurnoUseCase: FinalizarTurnoUseCase,
  ) { }

  @Post('iniciar')
  @HttpCode(HttpStatus.CREATED)
  async iniciar(
    @Body() body: IniciarTurnoRequestDto,
    @CurrentUser() user: any
  ) {
    try {
      const turno = await this.iniciarTurnoUseCase.execute({
        idOperador: body.idOperador,
        idMaquina: body.idMaquina,
        horometroInicial: body.horometroInicial,
      });
      return { id: turno.id, estado: turno.estadoActual };
    } catch (error: any) {
      return { error: error.message, stack: error.stack };
    }
  }

  @Post('finalizar')
  @HttpCode(HttpStatus.OK)
  async finalizar(
    @Body() body: FinalizarTurnoRequestDto,
    @CurrentUser() user: any
  ) {
    await this.finalizarTurnoUseCase.execute({
      idTurno: body.idTurno,
      horometroFinal: body.horometroFinal,
    });
    return { success: true };
  }
}
