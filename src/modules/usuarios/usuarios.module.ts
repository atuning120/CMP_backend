import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioOrmEntity } from './infrastructure/persistence/orm-entities/usuario.orm-entity';
import { UsuarioPostgresqlRepository } from './infrastructure/persistence/repositories/usuario.postgresql-repository';
import {
  CUENTA_MICROSOFT_REPOSITORY,
  GESTION_USUARIOS_REPOSITORY,
  USUARIO_REPOSITORY,
} from './domain/repositories/usuario.repository.port';
import { UsuarioController } from './interface/http/controllers/usuario.controller';
import { ListarUsuariosUseCase } from './application/use-cases/listar-usuarios.use-case';
import { CambiarRolUsuarioUseCase } from './application/use-cases/cambiar-rol-usuario.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioOrmEntity])],
  controllers: [UsuarioController],
  providers: [
    UsuarioPostgresqlRepository,
    { provide: USUARIO_REPOSITORY, useExisting: UsuarioPostgresqlRepository },
    { provide: CUENTA_MICROSOFT_REPOSITORY, useExisting: UsuarioPostgresqlRepository },
    { provide: GESTION_USUARIOS_REPOSITORY, useExisting: UsuarioPostgresqlRepository },
    ListarUsuariosUseCase,
    CambiarRolUsuarioUseCase,
  ],
  exports: [USUARIO_REPOSITORY, CUENTA_MICROSOFT_REPOSITORY],
})
export class UsuariosModule {}
