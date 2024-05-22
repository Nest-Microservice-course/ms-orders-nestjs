import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChangeOrderStatusDto, CreateOrderDto, OrderPaginationDto } from './dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PRODUCT_SERVICE } from '../config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrdersService');

  constructor( @Inject( PRODUCT_SERVICE ) private readonly productsClient: ClientProxy ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async create(createOrderDto: CreateOrderDto) {
    /*return this.order.create({
      data: createOrderDto
    });*/

    try {
      const productIds = createOrderDto.items.map(item => item.productId);
      const products: any[] = await firstValueFrom(this.productsClient.send({ cmd: 'validate_products' }, productIds));

      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        const item = products.find(product => product.id === orderItem.productId);
        return item.price * orderItem.quantity;
      }, 0);

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc + orderItem.quantity;
      }, 0);

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map(item => {
                return {
                  price: products.find(product => product.id === item.productId).price,
                  productId: item.productId,
                  quantity: item.quantity,
                }
              })
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              productId: true,
              quantity: true,
            }
          }
        }
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map(item => ({
          ...item,
          name: products.find(product => product.id === item.productId).name
        }))
      };
    } catch ( error ) {
      throw new RpcException( {
        status: HttpStatus.BAD_REQUEST,
        message: error.message
      } );
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
      where: {id},
      include: {
        OrderItem: {
          select: {
            price: true,
            productId: true,
            quantity: true
          }
        }
      }
    });

    if (!order) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: 'Order not found'
      });
    }

    const productIds = order.OrderItem.map(item => item.productId);
    const products: any[] = await firstValueFrom(this.productsClient.send({ cmd: 'validate_products' }, productIds));

    return {
      ...order,
      OrderItem: order.OrderItem.map(item => ({
        ...item,
        name: products.find(product => product.id === item.productId).name
      }))
    };
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
