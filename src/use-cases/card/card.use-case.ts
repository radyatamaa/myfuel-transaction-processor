import { Injectable } from '@nestjs/common';

@Injectable()
export class CardUseCases {
  status() {
    return {
      module: 'card',
      ready: true,
      note: 'Card module is wired and ready'
    };
  }
}
