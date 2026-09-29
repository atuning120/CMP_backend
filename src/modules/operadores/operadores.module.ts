import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperadorOrmEntity } from './infrastructure/persistence/orm-entities/operador.orm-entity';
import { OperadorPostgresqlRepository } from './infrastructure/persistence/repositories/operador.postgresql-repository';
import { OPERADOR_REPOSITORY } from './domain/repositories/operador.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([OperadorOrmEntity])],
  controllers: [],
  providers: [
    {
      provide: OPERADOR_REPOSITORY,
      useClass: OperadorPostgresqlRepository,
    },
  ],
  exports: [OPERADOR_REPOSITORY],
})
export class OperadoresModule {}
