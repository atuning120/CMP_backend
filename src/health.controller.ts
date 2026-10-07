import { Controller, Get } from '@nestjs/common';

// Para el health probe de Azure Container Apps y para verificar el despliegue desde el navegador
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
