import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true, autoIndex: true })
export class RefundAllocation {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Order' })
  orderId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Payment' })
  paymentId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  buyerId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  amountCents!: number;

  @Prop({ required: true, default: Date.now })
  refundedAt!: Date;
}

export type RefundAllocationDocument = HydratedDocument<RefundAllocation>;
export const RefundAllocationSchema =
  SchemaFactory.createForClass(RefundAllocation);
RefundAllocationSchema.index({ orderId: 1 }, { unique: true });
