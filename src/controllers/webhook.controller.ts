import { Controller, Get } from '@nestjs/common';

@Controller('webhooks')
export class WebhookController {
  @Get('status')
  status() {
    return {
      success: true,
      step: 3,
      message: 'Webhook module wired. No business logic yet.'
    };
  }
}
