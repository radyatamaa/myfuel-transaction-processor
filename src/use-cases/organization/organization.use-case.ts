import { Injectable } from '@nestjs/common';

@Injectable()
export class OrganizationUseCases {
  status() {
    return {
      module: 'organization',
      ready: true,
      note: 'Organization module is wired and ready'
    };
  }
}
