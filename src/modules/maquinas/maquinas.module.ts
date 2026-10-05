import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaquinaController } from './interface/http/controllers/maquina.controller';
import { ListarMaquinasActivasUseCase } from './application/use-cases/listar-maquinas-activas.use-case';
import { MaquinaOrmEntity } from './infrastructure/persistence/orm-entities/maquina.orm-entity';
import { MaquinaPostgresqlRepository } from './infrastructure/persistence/repositories/maquina.postgresql-repository';
import { MAQUINA_REPOSITORY } from './domain/repositories/maquina.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([MaquinaOrmEntity])],
  controllers: [MaquinaController],
  providers: [
    {
      provide: MAQUINA_REPOSITORY,
      useClass: MaquinaPostgresqlRepository,
    },
    ListarMaquinasActivasUseCase,
  ],
  exports: [MAQUINA_REPOSITORY],
})
export class MaquinasModule {}
