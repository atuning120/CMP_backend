import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IniciarTurnoUseCase } from '../../../application/use-cases/iniciar-turno.use-case';
import { FinalizarTurnoUseCase } from '../../../application/use-cases/finalizar-turno.use-case';
import { IniciarTurnoRequestDto } from '../dtos/iniciar-turno.request.dto';
import { FinalizarTurnoRequestDto } from '../dtos/finalizar-turno.request.dto';

@Controller('turnos')
export class TurnoController {
  constructor(
    private readonly iniciarTurnoUseCase: IniciarTurnoUseCase,
    private readonly finalizarTurnoUseCase: FinalizarTurnoUseCase,
  ) { }

  @Post('iniciar')
  @HttpCode(HttpStatus.CREATED)
  async iniciar(@Body() body: IniciarTurnoRequestDto) {
    const turno = await this.iniciarTurnoUseCase.execute({
      idOperador: body.idOperador,
      idMaquina: body.idMaquina,
      horometroInicial: body.horometroInicial,
    });
    return { id: turno.id, estado: turno.estadoActual };
  }

  @Post('finalizar')
  @HttpCode(HttpStatus.OK)
  async finalizar(@Body() body: FinalizarTurnoRequestDto) {
    await this.finalizarTurnoUseCase.execute({
      idTurno: body.idTurno,
      horometroFinal: body.horometroFinal,
    });
    return { success: true };
  }
}
