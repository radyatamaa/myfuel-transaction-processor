import { Injectable } from '@nestjs/common';

@Injectable()
export class TransactionUseCases {
  status() {
    return {
      module: 'transaction',
      ready: true,
      note: 'Step 3 module wiring only'
    };
  }
}
