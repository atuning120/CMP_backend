import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { ObtenerMapaGeocercasUseCase } from '../../../application/use-cases/obtener-mapa-geocercas.use-case';
import { GestionarGeocercasUseCase } from '../../../application/use-cases/gestionar-geocercas.use-case';
import type { Autor, GeocercaDto } from '../../../application/use-cases/gestionar-geocercas.use-case';

// Mapa de geocercas del panel web. Leer: cualquier usuario con sesión; escribir: solo ADMIN
@Controller('geocercas')
@UseGuards(JwtAuthGuard)
export class GeocercaController {
  constructor(
    private readonly obtenerMapaUseCase: ObtenerMapaGeocercasUseCase,
    private readonly gestionarUseCase: GestionarGeocercasUseCase,
  ) {}

  @Get('mapa')
  async mapa() {
    return this.obtenerMapaUseCase.execute();
  }

  @Post('areas')
  async crearArea(@Body() body: GeocercaDto, @CurrentUser() user: Autor) {
    return this.gestionarUseCase.crearArea(body, user);
  }

  @Patch('areas/:idArea')
  @HttpCode(HttpStatus.NO_CONTENT)
  async editarArea(@Param('idArea', ParseIntPipe) idArea: number, @Body() body: GeocercaDto, @CurrentUser() user: Autor) {
    await this.gestionarUseCase.editarArea(idArea, body, user);
  }

  @Delete('areas/:idArea')
  @HttpCode(HttpStatus.NO_CONTENT)
  async desactivarArea(@Param('idArea', ParseIntPipe) idArea: number, @CurrentUser() user: Autor) {
    await this.gestionarUseCase.desactivarArea(idArea, user);
  }

  @Post('areas/:idArea/zonas')
  async crearZona(@Param('idArea', ParseIntPipe) idArea: number, @Body() body: GeocercaDto, @CurrentUser() user: Autor) {
    return this.gestionarUseCase.crearZona(idArea, body, user);
  }

  @Patch('zonas/:idZona')
  @HttpCode(HttpStatus.NO_CONTENT)
  async editarZona(@Param('idZona', ParseIntPipe) idZona: number, @Body() body: GeocercaDto, @CurrentUser() user: Autor) {
    await this.gestionarUseCase.editarZona(idZona, body, user);
  }

  @Delete('zonas/:idZona')
  @HttpCode(HttpStatus.NO_CONTENT)
  async desactivarZona(@Param('idZona', ParseIntPipe) idZona: number, @CurrentUser() user: Autor) {
    await this.gestionarUseCase.desactivarZona(idZona, user);
  }
}
