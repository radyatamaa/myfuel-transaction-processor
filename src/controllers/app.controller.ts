import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  health() {
    return {
      success: true,
      message: 'ok'
    };
  }
}
