import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import {
  ProductCategory,
  ProductSeason,
  ProductUnit,
  ProductionMethod,
} from '../products/product.schema.js';

export enum AuctionStatus {
  Scheduled = 'scheduled',
  Active = 'active',
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

  @Prop({ required: true, default: 1, min: 1 })
  revision!: number;
}

export type AuctionDocument = HydratedDocument<Auction> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export const AuctionSchema = SchemaFactory.createForClass(Auction);
AuctionSchema.index({ producerId: 1, status: 1, startsAt: -1, _id: -1 });
AuctionSchema.index({ status: 1, startsAt: 1, _id: 1 });
AuctionSchema.index({ status: 1, endsAt: 1, _id: 1 });
