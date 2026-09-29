import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LoginOperadorUseCase } from '../../application/use-cases/login-operador.use-case';
import { LoginOperadorRequestDto } from '../dtos/login-operador.request.dto';
import { LoginWebRequestDto } from '../dtos/login-web.request.dto';
import { LoginWebUseCase } from '../../application/use-cases/login-web.use-case';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginOperadorUseCase: LoginOperadorUseCase,
    private readonly loginWebUseCase: LoginWebUseCase,
  ) {}

  @Post('login/operador')
  @HttpCode(HttpStatus.OK)
  async loginOperador(@Body() body: LoginOperadorRequestDto) {
    return this.loginOperadorUseCase.execute(body);
  }

  @Post('login/web')
  @HttpCode(HttpStatus.OK)
  async loginWeb(@Body() body: LoginWebRequestDto) {
    return this.loginWebUseCase.execute(body);
  }
}
