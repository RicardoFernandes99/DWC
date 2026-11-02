import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum PaymentStatus {
  Succeeded = 'succeeded',
  Failed = 'failed',
}

@Schema({ _id: false })
export class PaymentMethodSnapshot {
  @Prop({ required: true, match: /^\d{4}$/ })
  last4!: string;

  @Prop({ required: true, min: 1, max: 12 })
  expiryMonth!: number;

  @Prop({ required: true, min: 1000, max: 9999 })
  expiryYear!: number;
}

export const PaymentMethodSnapshotSchema = SchemaFactory.createForClass(
  PaymentMethodSnapshot,
);

@Schema({ timestamps: true, autoIndex: true })
export class Payment {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Checkout' })
  checkoutId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  buyerId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'PaymentMethod' })
  paymentMethodId!: Types.ObjectId;

  @Prop({ type: PaymentMethodSnapshotSchema, required: true })
  paymentMethodSnapshot!: PaymentMethodSnapshot;

  @Prop({ required: true, min: 0 })
  amountCents!: number;

  @Prop({
    required: true,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.Succeeded,
  })
  status!: PaymentStatus;
}

export type PaymentDocument = HydratedDocument<Payment> & {
  createdAt: Date;
  updatedAt: Date;
};

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ buyerId: 1, createdAt: -1 });
PaymentSchema.index({ checkoutId: 1 });
