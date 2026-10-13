import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioOrmEntity } from './infrastructure/persistence/orm-entities/usuario.orm-entity';
import { UsuarioPostgresqlRepository } from './infrastructure/persistence/repositories/usuario.postgresql-repository';
import { CUENTA_MICROSOFT_REPOSITORY, USUARIO_REPOSITORY } from './domain/repositories/usuario.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioOrmEntity])],
  controllers: [],
  providers: [
    UsuarioPostgresqlRepository,
    { provide: USUARIO_REPOSITORY, useExisting: UsuarioPostgresqlRepository },
    { provide: CUENTA_MICROSOFT_REPOSITORY, useExisting: UsuarioPostgresqlRepository },
  ],
  exports: [USUARIO_REPOSITORY, CUENTA_MICROSOFT_REPOSITORY],
})
export class UsuariosModule {}
