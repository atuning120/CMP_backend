import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../../../../turnos/interface/http/controllers/usuario-autenticado';
import { PrevisualizarCargaEpUseCase } from '../../../application/use-cases/previsualizar-carga-ep.use-case';
import { ConfirmarCargaEpUseCase } from '../../../application/use-cases/confirmar-carga-ep.use-case';
import { ListarCargasEpUseCase } from '../../../application/use-cases/listar-cargas-ep.use-case';
import { ObtenerDashboardUseCase } from '../../../application/use-cases/obtener-dashboard.use-case';
import { TAMANO_MAXIMO_EXCEL } from '../../../application/use-cases/leer-carga-ep';
import type { ArchivoEp } from '../../../application/use-cases/leer-carga-ep';
import type { CargaEp } from '../../../domain/repositories/carga-ep.repository.port';

// Campos de texto del multipart/form-data que acompañan al archivo
interface CamposCargaEp {
  periodo?: string; // AAAA-MM
  fechaDesde?: string; // AAAA-MM-DD
  fechaHasta?: string;
  reemplazar?: string; // "true" para reemplazar la carga que ya tiene el mes
}

const presentCarga = (carga: CargaEp) => ({ ...carga, subidoEn: carga.subidoEn.toISOString() });

// /dashboards/operacion y /dashboards/estado-pago
const TIPOS: Record<string, string> = { operacion: 'OPERACION', 'estado-pago': 'ESTADO_PAGO' };

// Con límite: multer corta la subida al pasar los 10 MB en vez de guardar el archivo entero en memoria
const subidaExcel = FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO_EXCEL, files: 1 } });

// Dashboards de Metabase embebidos en la web y carga mensual del Excel del estado de pago (EP) del contratista
@Controller('dashboards')
@UseGuards(JwtAuthGuard)
export class DashboardsController {
  constructor(
    private readonly previsualizarCargaEpUseCase: PrevisualizarCargaEpUseCase,
    private readonly confirmarCargaEpUseCase: ConfirmarCargaEpUseCase,
    private readonly listarCargasEpUseCase: ListarCargasEpUseCase,
    private readonly obtenerDashboardUseCase: ObtenerDashboardUseCase,
  ) {}

  @Get('cargas')
  async listarCargas(@CurrentUser() user: UsuarioAutenticado) {
    return (await this.listarCargasEpUseCase.execute(user?.rol)).map(presentCarga);
  }

  // multipart/form-data: periodo, fechaDesde, fechaHasta y el Excel en "archivo". No guarda nada
  @Post('cargas/previsualizar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(subidaExcel)
  async previsualizar(@Body() body: CamposCargaEp, @UploadedFile() archivo: ArchivoEp | undefined, @CurrentUser() user: UsuarioAutenticado) {
    const vista = await this.previsualizarCargaEpUseCase.execute({ rol: user?.rol, ...body, archivo });
    return { ...vista, cargaExistente: vista.cargaExistente && presentCarga(vista.cargaExistente) };
  }

  // Mismos campos que la vista previa (el archivo se vuelve a enviar) y reemplazar=true si el mes ya tiene carga
  @Post('cargas')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(subidaExcel)
  async confirmar(@Body() body: CamposCargaEp, @UploadedFile() archivo: ArchivoEp | undefined, @CurrentUser() user: UsuarioAutenticado) {
    const carga = await this.confirmarCargaEpUseCase.execute({
      rol: user?.rol,
      idUsuario: user?.idUsuario,
      periodo: body.periodo,
      fechaDesde: body.fechaDesde,
      fechaHasta: body.fechaHasta,
      reemplazar: body.reemplazar === 'true',
      archivo,
    });
    return presentCarga(carga);
  }

  // URL firmada para el <iframe>, válida por una hora. ?periodo=AAAA-MM para estado-pago
  @Get(':tipo')
  async dashboard(@Param('tipo') tipo: string, @Query('periodo') periodo: string | undefined, @CurrentUser() user: UsuarioAutenticado) {
    const { url, expiraEn, carga } = await this.obtenerDashboardUseCase.execute({ rol: user?.rol, tipo: TIPOS[tipo], periodo });
    return { url, expiraEn: expiraEn.toISOString(), carga: carga && presentCarga(carga) };
  }
}
