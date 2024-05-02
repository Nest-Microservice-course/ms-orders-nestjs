import { PaginationDto } from '../../common';
import { OrderStatusList } from '../enums/order.enum';
import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class OrderPaginationDto extends PaginationDto {
  @IsOptional()
  @IsEnum( OrderStatusList, {
    message: `Status must be one of the following: ${ OrderStatusList.join( ', ' ) }`
  } )
  status: OrderStatus;
}
