import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChangeOrderStatusDto, CreateOrderDto, OrderPaginationDto } from './dto';
import { PrismaClient } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrdersService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  create(createOrderDto: CreateOrderDto) {
    /*return this.order.create({
      data: createOrderDto
    });*/

    return {
      service: 'OrdersService',
      createOrderDto
    }
  }

  async findAll(paginationDto: OrderPaginationDto) {
    const { limit, page, status } = paginationDto;
    const skip = ( page - 1 ) * limit;

    const orders = await this.order.findMany({
      where: { status },
      take: limit,
      skip
    });

    const total = await this.order.count({
      where: { status }
    });

    return {
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(id: string) {
    const order = await this.order.findFirst({
      where: {id}
    });

    if (!order) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: 'Order not found'
      });
    }

    return order;
  }

  async changeStatus( changeOrderStatusDto: ChangeOrderStatusDto ) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne( id );

    if (order.status === status) {
      return order;
    }

    return this.order.update({
      where: { id },
      data: { status }
    });
  }
}
