import { Injectable } from '@nestjs/common';

@Injectable()
export class CardUseCases {
  status() {
    return {
      module: 'card',
      ready: true,
      note: 'Step 3 module wiring only'
    };
  }
}
