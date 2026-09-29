import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioOrmEntity } from './infrastructure/persistence/orm-entities/usuario.orm-entity';
import { UsuarioPostgresqlRepository } from './infrastructure/persistence/repositories/usuario.postgresql-repository';
import { USUARIO_REPOSITORY } from './domain/repositories/usuario.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioOrmEntity])],
  controllers: [],
  providers: [
    {
      provide: USUARIO_REPOSITORY,
      useClass: UsuarioPostgresqlRepository,
    },
  ],
  exports: [USUARIO_REPOSITORY],
})
export class UsuariosModule {}
