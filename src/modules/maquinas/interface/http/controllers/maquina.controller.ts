import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ListarMaquinasActivasUseCase } from '../../../application/use-cases/listar-maquinas-activas.use-case';
import { ListarFlotaUseCase } from '../../../application/use-cases/listar-flota.use-case';
import { CrearMaquinaUseCase } from '../../../application/use-cases/crear-maquina.use-case';
import { CrearMaquinaRequestDto } from '../dtos/crear-maquina.request.dto';

@Controller('maquinas')
@UseGuards(JwtAuthGuard)
export class MaquinaController {
  constructor(
    private readonly listarMaquinasActivasUseCase: ListarMaquinasActivasUseCase,
    private readonly listarFlotaUseCase: ListarFlotaUseCase,
    private readonly crearMaquinaUseCase: CrearMaquinaUseCase,
  ) {}

  @Get()
  async listarActivas() {
    return this.listarMaquinasActivasUseCase.execute();
  }

  // Vista del jefe de turno: todas las máquinas (también BAJA), filtradas por ?busqueda=
  @Get('flota')
  async listarFlota(@Query('busqueda') busqueda?: string) {
    return this.listarFlotaUseCase.execute(typeof busqueda === 'string' ? busqueda : undefined);
  }

  // Incorporación de una máquina nueva a planta (jefe de turno)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() body: CrearMaquinaRequestDto, @CurrentUser() user: { rol: string }) {
    return this.crearMaquinaUseCase.execute({
      rol: user?.rol,
      nombre: body?.nombre,
      marca: body?.marca,
      modelo: body?.modelo,
      anio: body?.anio,
      tipoMaquina: body?.tipoMaquina,
      patente: body?.patente,
      numeroChasis: body?.numeroChasis,
      horometroInicial: body?.horometroInicial,
      esContratista: body?.esContratista,
    });
  }
}
