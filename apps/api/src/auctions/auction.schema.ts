import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  ProductCategory,
  ProductSeason,
  ProductUnit,
  ProductionMethod,
} from '../products/product.schema.js';
import {
  PaymentMethodSnapshot,
  PaymentMethodSnapshotSchema,
} from '../checkout/payment.schema.js';

export enum AuctionStatus {
  Scheduled = 'scheduled',
  Active = 'active',
  Finished = 'finished',
  Cancelled = 'cancelled',
}

@Schema({ _id: false })
export class AuctionProductSnapshot {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 120 })
  name!: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 2000 })
  description!: string;

  @Prop({ required: true, enum: Object.values(ProductCategory) })
  category!: ProductCategory;

  @Prop({ required: true, enum: Object.values(ProductionMethod) })
  productionMethod!: ProductionMethod;

  @Prop({ required: true, type: [String], enum: Object.values(ProductSeason) })
  seasons!: ProductSeason[];

  @Prop({ required: true, enum: Object.values(ProductUnit) })
  unit!: ProductUnit;
}

export const AuctionProductSnapshotSchema = SchemaFactory.createForClass(
  AuctionProductSnapshot,
);

@Schema({ timestamps: true, autoIndex: true })
export class Auction {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  producerId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ type: AuctionProductSnapshotSchema, required: true })
  productSnapshot!: AuctionProductSnapshot;

  @Prop({ required: true, min: 1, max: 1_000_000 })
  quantity!: number;

  @Prop({ required: true, min: 1, max: 100_000_000 })
  startingPriceCents!: number;

  @Prop({ required: true, min: 1, max: 100_000_000 })
  minimumIncrementCents!: number;

  @Prop({ required: true, type: Date })
  startsAt!: Date;

  @Prop({ required: true, type: Date })
  endsAt!: Date;

  @Prop({ required: true, type: String, enum: Object.values(AuctionStatus) })
  status!: AuctionStatus;

  @Prop({ type: Number, default: null, min: 1 })
  currentBidCents!: number | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  currentBidderId!: Types.ObjectId | null;

  @Prop({ type: String, trim: true, maxlength: 100, default: null })
  currentBidderName!: string | null;

  @Prop({ type: Date, default: null })
  lastBidAt!: Date | null;

  @Prop({ required: true, default: 1, min: 1 })
  revision!: number;

  @Prop({ required: true, default: false })
  closureNotificationsPending!: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AuctionBid', default: null })
  closureNotificationCursor!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  closedAt!: Date | null;
}

export type AuctionDocument = HydratedDocument<Auction> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export const AuctionSchema = SchemaFactory.createForClass(Auction);
AuctionSchema.index({ producerId: 1, status: 1, startsAt: -1, _id: -1 });
AuctionSchema.index({ status: 1, startsAt: 1, _id: 1 });
AuctionSchema.index({ status: 1, endsAt: 1, _id: 1 });
AuctionSchema.index({ status: 1, closureNotificationsPending: 1, _id: 1 });

@Schema({ timestamps: { createdAt: true, updatedAt: false }, autoIndex: true })
export class AuctionBid {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Auction', required: true })
  auctionId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  buyerId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  bidderName!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'PaymentMethod', required: true })
  paymentMethodId!: Types.ObjectId;

  @Prop({ type: PaymentMethodSnapshotSchema, default: null })
  paymentMethodSnapshot!: PaymentMethodSnapshot | null;

  @Prop({ required: true, match: /^[0-9a-f-]{36}$/i })
  requestId!: string;

  @Prop({ required: true, min: 1, max: 100_000_000 })
  amountCents!: number;

  @Prop({ required: true, min: 1, max: 100_000_000 })
  startingPriceCents!: number;

  @Prop({ required: true, min: 1, max: 100_000_000 })
  minimumIncrementCents!: number;

  @Prop({ required: true, type: Date })
  acceptedAt!: Date;

  @Prop({ required: true, type: Date })
  endsAt!: Date;

  @Prop({ required: true, min: 1 })
  revision!: number;
}

export type AuctionBidDocument = HydratedDocument<AuctionBid>;
export const AuctionBidSchema = SchemaFactory.createForClass(AuctionBid);
AuctionBidSchema.index({ auctionId: 1, acceptedAt: -1, _id: -1 });
AuctionBidSchema.index({ auctionId: 1, buyerId: 1 });
AuctionBidSchema.index({ buyerId: 1, requestId: 1 }, { unique: true });
