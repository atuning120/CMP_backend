import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { idOperadorDe } from '../../../../turnos/interface/http/controllers/usuario-autenticado';
import type { UsuarioAutenticado } from '../../../../turnos/interface/http/controllers/usuario-autenticado';
import { CrearReporteUseCase } from '../../../application/use-cases/crear-reporte.use-case';
import { SubirEvidenciaUseCase, TAMANO_MAXIMO_EVIDENCIA } from '../../../application/use-cases/subir-evidencia.use-case';
import { ObtenerArchivoEvidenciaUseCase } from '../../../application/use-cases/obtener-archivo-evidencia.use-case';
import { CrearReporteRequestDto, SubirEvidenciaRequestDto } from '../dtos/evidencias.request.dto';
import type { ReporteRegistro } from '../../../domain/repositories/reporte.repository.port';
import type { EvidenciaRegistro } from '../../../domain/repositories/evidencia.repository.port';

interface ArchivoSubido {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}

const presentReporte = (reporte: ReporteRegistro) => ({
  id: reporte.idReporte,
  idCliente: reporte.idCliente,
  idTurno: reporte.idTurno,
  tipo: reporte.tipo,
  descripcion: reporte.descripcion,
  fechaHora: reporte.fechaHora.toISOString(),
});

const presentEvidencia = (evidencia: EvidenciaRegistro) => ({
  id: evidencia.idEvidencia,
  idCliente: evidencia.idCliente,
  idReporte: evidencia.idReporte,
  fechaHora: evidencia.fechaHora.toISOString(),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class EvidenciaController {
  constructor(
    private readonly crearReporteUseCase: CrearReporteUseCase,
    private readonly subirEvidenciaUseCase: SubirEvidenciaUseCase,
    private readonly obtenerArchivoEvidenciaUseCase: ObtenerArchivoEvidenciaUseCase,
  ) {}

  @Post('reportes')
  @HttpCode(HttpStatus.CREATED)
  async crearReporte(@Body() body: CrearReporteRequestDto, @CurrentUser() user: UsuarioAutenticado) {
    const reporte = await this.crearReporteUseCase.execute({
      idOperador: idOperadorDe(user),
      idCliente: body.idCliente,
      idTurno: body.idTurno === undefined ? null : Number(body.idTurno),
      idClienteTurno: body.idClienteTurno,
      tipo: body.tipo,
      descripcion: body.descripcion,
      fechaHora: body.fechaHora,
    });
    return presentReporte(reporte);
  }

  // multipart/form-data: campos idCliente, idClienteReporte, fechaHora y el archivo en "archivo"
  @Post('evidencias')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO_EVIDENCIA } }))
  async subirEvidencia(
    @Body() body: SubirEvidenciaRequestDto,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    const evidencia = await this.subirEvidenciaUseCase.execute({
      idOperador: idOperadorDe(user),
      idCliente: body.idCliente,
      idClienteReporte: body.idClienteReporte,
      fechaHora: body.fechaHora,
      archivo,
    });
    return presentEvidencia(evidencia);
  }

  @Get('evidencias/:idCliente/archivo')
  async archivo(@Param('idCliente') idCliente: string, @CurrentUser() user: UsuarioAutenticado) {
    const { contenido, mimeType } = await this.obtenerArchivoEvidenciaUseCase.execute(idCliente, user);
    return new StreamableFile(contenido, { type: mimeType });
  }
}
