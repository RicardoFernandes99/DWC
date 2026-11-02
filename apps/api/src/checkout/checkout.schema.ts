import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { FulfilmentMethod } from '../orders/order.schema.js';
import type { DeliveryAddressDto } from './checkout.dto.js';

@Schema({ timestamps: true, autoIndex: true })
export class Checkout {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  buyerId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  idempotencyKey!: string;

  @Prop({ required: true })
  requestPayloadHash!: string;

  @Prop({ required: true })
  quoteFingerprint!: string;

  @Prop({ required: true, enum: Object.values(FulfilmentMethod) })
  fulfilmentMethod!: FulfilmentMethod;

  @Prop({ type: Object, default: null })
  deliveryAddress!: DeliveryAddressDto | null;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Payment' })
  paymentId!: Types.ObjectId;

  @Prop({
    type: [{ type: SchemaTypes.ObjectId, ref: 'Order' }],
    required: true,
  })
  orderIds!: Types.ObjectId[];

  @Prop({ required: true, min: 0 })
  subtotalCents!: number;

  @Prop({ required: true, min: 0 })
  deliveryFeeCents!: number;

  @Prop({ required: true, min: 0 })
  totalCents!: number;
}

export type CheckoutDocument = HydratedDocument<Checkout> & {
  createdAt: Date;
  updatedAt: Date;
};

export const CheckoutSchema = SchemaFactory.createForClass(Checkout);
CheckoutSchema.index({ buyerId: 1, idempotencyKey: 1 }, { unique: true });
CheckoutSchema.index({ buyerId: 1, createdAt: -1 });
