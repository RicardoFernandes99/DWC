import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Order,
  OrderOrigin,
  OrderStatus,
  RefundRequestStatus,
} from '../orders/order.schema.js';
import { Product, ProductUnit } from '../products/product.schema.js';
import type {
  MetricsPeriod,
  ProducerMetricsResponseDto,
} from './producer-metrics.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<Exclude<MetricsPeriod, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};
const BEST_SELLER_LIMIT = 5;
const LOW_STOCK_LIMIT = 50;

interface SalesGroup {
  _id: OrderOrigin;
  orderCount: number;
  productRevenueCents: number;
  deliveryFeesCents: number;
}

interface BestSellerGroup {
  _id: Types.ObjectId;
  productName: string;
  orderCount: number;
  productRevenueCents: number;
}

interface UnitGroup {
  _id: { productId: Types.ObjectId; unit: ProductUnit };
  quantity: number;
}

@Injectable()
export class ProducerMetricsService {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
  ) {}

  async metrics(
    producerId: string,
    period: MetricsPeriod,
  ): Promise<ProducerMetricsResponseDto> {
    const now = new Date();
    const from =
      period === 'all'
        ? null
        : new Date(now.getTime() - PERIOD_DAYS[period] * DAY_MS);
    const producer = new Types.ObjectId(producerId);
    // Served by the {producerId, createdAt} order index. Cancelled orders
    // (including every refunded order) are excluded from sales.
    const match = {
      producerId: producer,
      status: { $ne: OrderStatus.Cancelled },
      ...(from ? { createdAt: { $gte: from, $lte: now } } : {}),
    };

    const previousFrom =
      from === null
        ? null
        : new Date(
            from.getTime() -
              PERIOD_DAYS[period as keyof typeof PERIOD_DAYS] * DAY_MS,
          );
    const [
      salesGroups,
      bestGroups,
      lowStock,
      dailyGroups,
      previousGroups,
      pendingOrders,
      openRefunds,
    ] = await Promise.all([
      this.orders.aggregate<SalesGroup>([
        { $match: match },
        {
          $group: {
            _id: '$origin',
            orderCount: { $sum: 1 },
            productRevenueCents: { $sum: { $sum: '$items.lineTotalCents' } },
            deliveryFeesCents: { $sum: '$deliveryFeeCents' },
          },
        },
      ]),
      this.orders.aggregate<BestSellerGroup>([
        { $match: match },
        { $sort: { createdAt: 1 } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            productName: { $last: '$items.productName' },
            orders: { $addToSet: '$_id' },
            productRevenueCents: { $sum: '$items.lineTotalCents' },
          },
        },
        {
          $project: {
            productName: 1,
            productRevenueCents: 1,
            orderCount: { $size: '$orders' },
          },
        },
        { $sort: { productRevenueCents: -1, orderCount: -1, _id: 1 } },
        { $limit: BEST_SELLER_LIMIT },
      ]),
      this.lowStock(producer),
      from
        ? this.orders.aggregate<{ _id: string; orderCount: number }>([
            { $match: match },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                orderCount: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
      from && previousFrom
        ? this.orders.aggregate<{
            orderCount: number;
            productRevenueCents: number;
          }>([
            {
              $match: {
                producerId: producer,
                status: { $ne: OrderStatus.Cancelled },
                createdAt: { $gte: previousFrom, $lt: from },
              },
            },
            {
              $group: {
                _id: null,
                orderCount: { $sum: 1 },
                productRevenueCents: {
                  $sum: { $sum: '$items.lineTotalCents' },
                },
              },
            },
          ])
        : Promise.resolve(null),
      this.orders.countDocuments({
        producerId: producer,
        status: OrderStatus.Pending,
      }),
      this.orders.countDocuments({
        producerId: producer,
        'refundRequest.status': RefundRequestStatus.Open,
      }),
    ]);

    // Zero-filled UTC days from the window start to today.
    const daily: { date: string; orderCount: number }[] = [];
    if (from) {
      const counts = new Map(dailyGroups.map((g) => [g._id, g.orderCount]));
      const day = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
      );
      while (day.getTime() <= now.getTime()) {
        const key = day.toISOString().slice(0, 10);
        daily.push({ date: key, orderCount: counts.get(key) ?? 0 });
        day.setUTCDate(day.getUTCDate() + 1);
      }
    }

    const unitGroups = bestGroups.length
      ? await this.orders.aggregate<UnitGroup>([
          { $match: match },
          { $unwind: '$items' },
          {
            $match: {
              'items.productId': { $in: bestGroups.map((g) => g._id) },
            },
          },
          {
            $group: {
              _id: {
                productId: '$items.productId',
                unit: '$items.productUnit',
              },
              quantity: { $sum: '$items.quantity' },
            },
          },
          { $sort: { '_id.unit': 1 } },
        ])
      : [];

    const origin = (key: OrderOrigin) => {
      const group = salesGroups.find((g) => g._id === key);
      return {
        orderCount: group?.orderCount ?? 0,
        productRevenueCents: group?.productRevenueCents ?? 0,
      };
    };
    const sum = (
      key: 'orderCount' | 'productRevenueCents' | 'deliveryFeesCents',
    ) => salesGroups.reduce((total, g) => total + g[key], 0);

    return {
      period,
      from: from ? from.toISOString() : null,
      to: now.toISOString(),
      sales: {
        orderCount: sum('orderCount'),
        productRevenueCents: sum('productRevenueCents'),
        deliveryFeesCents: sum('deliveryFeesCents'),
        catalogue: origin(OrderOrigin.Catalogue),
        auction: origin(OrderOrigin.Auction),
      },
      bestSellers: bestGroups.map((group) => ({
        productId: group._id.toHexString(),
        productName: group.productName,
        orderCount: group.orderCount,
        productRevenueCents: group.productRevenueCents,
        unitsSold: unitGroups
          .filter((u) => u._id.productId.equals(group._id))
          .map((u) => ({ unit: u._id.unit, quantity: u.quantity })),
      })),
      lowStock,
      daily,
      previous: previousGroups
        ? {
            orderCount: previousGroups[0]?.orderCount ?? 0,
            productRevenueCents: previousGroups[0]?.productRevenueCents ?? 0,
          }
        : null,
      attention: { pendingOrders, openRefunds },
    };
  }

  private async lowStock(
    producer: Types.ObjectId,
  ): Promise<ProducerMetricsResponseDto['lowStock']> {
    // Same rule as ProductsService isLowStock. availableStock already excludes
    // auction-reserved stock, so reservedStock is informational only.
    const filter = {
      producerId: producer,
      archivedAt: null,
      $expr: { $lte: ['$availableStock', '$lowStockThreshold'] },
    };
    const [totalCount, items] = await Promise.all([
      this.products.countDocuments(filter),
      this.products
        .find(filter)
        .select(
          'name unit availableStock reservedStock lowStockThreshold published',
        )
        .sort({ availableStock: 1, _id: 1 })
        .limit(LOW_STOCK_LIMIT)
        .lean(),
    ]);
    return {
      totalCount,
      items: items.map((product) => ({
        productId: product._id.toHexString(),
        name: product.name,
        unit: product.unit,
        availableStock: product.availableStock,
        reservedStock: product.reservedStock ?? 0,
        lowStockThreshold: product.lowStockThreshold,
        published: product.published,
      })),
    };
  }
}
