import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LoginOperadorUseCase } from '../../../application/use-cases/login-operador.use-case';
import { LoginRequestDto } from '../dtos/login-operador.request.dto';
import { RegisterOperadorRequestDto } from '../dtos/register-operador.request.dto';
import { LoginWebRequestDto } from '../dtos/login-web.request.dto';
import { LoginWebUseCase } from '../../../application/use-cases/login-web.use-case';
import { RegisterOperadorUseCase } from '../../../application/use-cases/register-operador.use-case';
import { RegisterJefeTurnoUseCase } from '../../../application/use-cases/register-jefe-turno.use-case';
import { RegisterJefeTurnoRequestDto } from '../dtos/register-jefe-turno.request.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginOperadorUseCase: LoginOperadorUseCase,
    private readonly loginWebUseCase: LoginWebUseCase,
    private readonly registerOperadorUseCase: RegisterOperadorUseCase,
    private readonly registerJefeTurnoUseCase: RegisterJefeTurnoUseCase,
  ) { }

  @Post('register/operador')
  async registerOperador(@Body() body: RegisterOperadorRequestDto) {
    return this.registerOperadorUseCase.execute(body);
  }

  @Post('register/jefe-turno')
  async registerJefeTurno(@Body() body: RegisterJefeTurnoRequestDto) {
    return this.registerJefeTurnoUseCase.execute(body);
  }

  @Post('login/operador')
  @HttpCode(HttpStatus.OK)
  async loginOperador(@Body() body: LoginRequestDto) {
    return this.loginOperadorUseCase.execute(body);
  }

  @Post('login/web')
  @HttpCode(HttpStatus.OK)
  async loginWeb(@Body() body: LoginWebRequestDto) {
    return this.loginWebUseCase.execute(body);
  }
}
