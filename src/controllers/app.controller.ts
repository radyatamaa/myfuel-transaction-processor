import { Controller, Get, Req } from '@nestjs/common';

interface RequestLike {
  requestId?: string;
}

@Controller('health')
export class AppController {
  @Get()
  health(@Req() request: RequestLike) {
    return {
      success: true,
      code: 'SUCCESS',
      message: 'ok',
      data: {},
      errors: null,
      timestamp: new Date().toISOString(),
      request_id: request.requestId
    };
  }
}
