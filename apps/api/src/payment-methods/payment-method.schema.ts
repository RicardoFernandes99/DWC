import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, autoIndex: true })
export class PaymentMethod {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  ownerId!: Types.ObjectId;

  @Prop({ required: true, match: /^\d{4}$/ })
  last4!: string;

  @Prop({ required: true, min: 1, max: 12 })
  expiryMonth!: number;

  @Prop({ required: true, min: 1000, max: 9999 })
  expiryYear!: number;
}

export type PaymentMethodDocument = HydratedDocument<PaymentMethod>;
export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);
PaymentMethodSchema.index({ ownerId: 1, createdAt: -1, _id: -1 });
