import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

interface RequestLike {
  requestId?: string;
}

@ApiTags('Health')
@Controller('health')
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  @ApiOkResponse({
    description: 'Service is healthy',
    schema: {
      example: {
        success: true,
        code: 'SUCCESS',
        message: 'ok',
        data: {},
        errors: null,
        timestamp: '2026-02-12T10:00:00.000Z',
        requestId: 'a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d'
      }
    }
  })
  health(@Req() request: RequestLike) {
    return {
      success: true,
      code: 'SUCCESS',
      message: 'ok',
      data: {},
      errors: null,
      timestamp: new Date().toISOString(),
      requestId: request.requestId
    };
  }
}
