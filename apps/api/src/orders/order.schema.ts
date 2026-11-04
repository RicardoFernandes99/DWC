import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { ProductUnit } from '../products/product.schema.js';
import type { DeliveryAddressDto } from '../checkout/checkout.dto.js';
import { UserRole } from '../users/user.schema.js';

export enum FulfilmentMethod {
  Delivery = 'delivery',
  Collection = 'collection',
}

export enum OrderStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Shipped = 'shipped',
  Delivered = 'delivered',
  ReadyForCollection = 'ready_for_collection',
  Collected = 'collected',
  Cancelled = 'cancelled',
}

export enum OrderOrigin {
  Catalogue = 'catalogue',
  Auction = 'auction',
}

export enum RefundRequestStatus {
  Open = 'open',
  Declined = 'declined',
  Accepted = 'accepted',
}

@Schema({ _id: false })
export class RefundRequest {
  @Prop({ required: true, enum: Object.values(RefundRequestStatus) })
  status!: RefundRequestStatus;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  requestedBy!: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  requestedAt!: Date;

  @Prop({ type: String, trim: true, maxlength: 500, default: null })
  reason!: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  decidedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  decidedAt!: Date | null;

  @Prop({ type: Number, min: 0, default: null })
  refundedCents!: number | null;
}

export const RefundRequestSchema = SchemaFactory.createForClass(RefundRequest);

@Schema({ _id: false })
export class OrderLineSnapshot {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Product' })
  productId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  productName!: string;

  @Prop({ required: true, enum: Object.values(ProductUnit) })
  productUnit!: ProductUnit;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  unitPriceCents!: number;

  @Prop({ required: true, min: 0 })
  lineTotalCents!: number;
}

export const OrderLineSnapshotSchema =
  SchemaFactory.createForClass(OrderLineSnapshot);

@Schema({ _id: false })
export class OrderStatusHistoryEntry {
  @Prop({ required: true, enum: Object.values(OrderStatus) })
  status!: OrderStatus;

  @Prop({ required: true, default: Date.now })
  timestamp!: Date;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  actorId!: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(UserRole) })
  actorRole!: UserRole;

  @Prop({ type: String, default: null, trim: true })
  note!: string | null;
}

export const OrderStatusHistoryEntrySchema = SchemaFactory.createForClass(
  OrderStatusHistoryEntry,
);

@Schema({ timestamps: true, autoIndex: true })
export class Order {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Checkout', default: null })
  checkoutId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Auction', default: null })
  auctionId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  buyerId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  producerId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Payment' })
  paymentId!: Types.ObjectId;

  @Prop({ type: [OrderLineSnapshotSchema], required: true })
  items!: OrderLineSnapshot[];

  @Prop({ required: true, enum: Object.values(FulfilmentMethod) })
  fulfilmentMethod!: FulfilmentMethod;

  @Prop({ type: Object, default: null })
  deliveryAddress!: DeliveryAddressDto | null;

  @Prop({ required: true, min: 0 })
  subtotalCents!: number;

  @Prop({ required: true, min: 0 })
  deliveryFeeCents!: number;

  @Prop({ required: true, min: 0 })
  totalCents!: number;

  @Prop({
    required: true,
    enum: Object.values(OrderStatus),
    default: OrderStatus.Pending,
  })
  status!: OrderStatus;

  @Prop({ type: [OrderStatusHistoryEntrySchema], required: true, default: [] })
  statusHistory!: OrderStatusHistoryEntry[];

  @Prop({
    required: true,
    enum: Object.values(OrderOrigin),
    default: OrderOrigin.Catalogue,
  })
  origin!: OrderOrigin;

  @Prop({ type: Number, required: true, default: 1, min: 1 })
  revision!: number;

  @Prop({ type: RefundRequestSchema, default: null })
  refundRequest!: RefundRequest | null;
}

export type OrderDocument = HydratedDocument<Order> & {
  createdAt: Date;
  updatedAt: Date;
};

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ buyerId: 1, createdAt: -1 });
OrderSchema.index({ producerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1, _id: -1 });
OrderSchema.index({ origin: 1, createdAt: -1, _id: -1 });
OrderSchema.index({ fulfilmentMethod: 1, createdAt: -1, _id: -1 });
OrderSchema.index({ checkoutId: 1 });
OrderSchema.index(
  { auctionId: 1 },
  {
    unique: true,
    partialFilterExpression: { auctionId: { $type: 'objectId' } },
  },
);
