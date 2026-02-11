import { ApiProperty } from '@nestjs/swagger';
import { RejectionReason, WebhookResponseStatus } from 'src/core/entities';

export class WebhookResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ enum: WebhookResponseStatus, example: WebhookResponseStatus.APPROVED })
  status!: WebhookResponseStatus;

  @ApiProperty({ example: 'Validation passed. Transaction write flow will be added in next step.' })
  message!: string;

  @ApiProperty({ required: false, enum: RejectionReason, nullable: true, example: null })
  reason?: RejectionReason | null;

  @ApiProperty({ example: 'station-abc-20260211-0001' })
  requestId!: string;
}
