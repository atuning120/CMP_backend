import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './interface/http/controllers/auth.controller';
import { LoginOperadorUseCase } from './application/use-cases/login-operador.use-case';
import { LoginWebUseCase } from './application/use-cases/login-web.use-case';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { OperadoresModule } from '../operadores/operadores.module';

@Module({
  imports: [
    UsuariosModule,
    OperadoresModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'super_secret_dev_key'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [LoginOperadorUseCase, LoginWebUseCase],
  exports: [JwtModule],
})
export class AuthModule {}
