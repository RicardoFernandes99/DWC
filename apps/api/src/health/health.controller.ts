import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Check whether the API process is running' })
  @ApiResponse({ status: 200, description: 'The API process is running.' })
  live() {
    return { status: 'ok', service: 'dwc-api' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check MongoDB, Redis, and the private S3 bucket' })
  @ApiResponse({ status: 200, description: 'All dependencies are reachable.' })
  @ApiResponse({
    status: 503,
    description: 'A required dependency is unavailable.',
  })
  ready() {
    return this.health.readiness();
  }
}
