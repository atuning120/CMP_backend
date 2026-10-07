import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ListarMaquinasActivasUseCase } from '../../../application/use-cases/listar-maquinas-activas.use-case';
import { ListarFlotaUseCase } from '../../../application/use-cases/listar-flota.use-case';
import { CrearMaquinaUseCase } from '../../../application/use-cases/crear-maquina.use-case';
import { ListarTiposMaquinaUseCase } from '../../../application/use-cases/listar-tipos-maquina.use-case';
import { ListarMarcasMaquinaUseCase } from '../../../application/use-cases/listar-marcas-maquina.use-case';
import { CrearMaquinaRequestDto } from '../dtos/crear-maquina.request.dto';

@Controller('maquinas')
@UseGuards(JwtAuthGuard)
export class MaquinaController {
  constructor(
    private readonly listarMaquinasActivasUseCase: ListarMaquinasActivasUseCase,
    private readonly listarFlotaUseCase: ListarFlotaUseCase,
    private readonly crearMaquinaUseCase: CrearMaquinaUseCase,
    private readonly listarTiposMaquinaUseCase: ListarTiposMaquinaUseCase,
    private readonly listarMarcasMaquinaUseCase: ListarMarcasMaquinaUseCase,
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

  // Opciones del selector "Tipo de máquina" al incorporar una máquina
  @Get('tipos')
  async listarTipos() {
    return this.listarTiposMaquinaUseCase.execute();
  }

  // Opciones del selector "Marca" al incorporar una máquina
  @Get('marcas')
  async listarMarcas() {
    return this.listarMarcasMaquinaUseCase.execute();
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
