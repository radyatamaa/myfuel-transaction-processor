import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsPositive, IsString, MaxLength } from 'class-validator';

export class ProcessTransactionDto {
  @ApiProperty({ example: 'station-abc-20260211-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  requestId!: string;

  @ApiProperty({ example: '6037991234561001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  cardNumber!: string;

  @ApiProperty({ example: 350000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: '2026-02-11T09:00:00Z' })
  @IsDateString()
  transactionAt!: string;

  @ApiProperty({ example: 'SPBU-12345' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  stationId!: string;
}
