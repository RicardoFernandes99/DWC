import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum ReviewVisibility {
  Visible = 'visible',
  Hidden = 'hidden',
}

@Schema({ timestamps: true, autoIndex: true })
export class Review {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  authorId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Order' })
  orderId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  producerId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ type: String, default: null, trim: true, maxlength: 1000 })
  comment!: string | null;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(ReviewVisibility),
    default: ReviewVisibility.Visible,
  })
  visibility!: ReviewVisibility;
}

export type ReviewDocument = HydratedDocument<Review> & {
  createdAt: Date;
  updatedAt: Date;
};

export const ReviewSchema = SchemaFactory.createForClass(Review);
// The database is the authority for one review per order.
ReviewSchema.index({ orderId: 1 }, { unique: true });
ReviewSchema.index({ producerId: 1, visibility: 1, createdAt: -1 });
