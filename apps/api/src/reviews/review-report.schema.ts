import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum ReviewReportCategory {
  Spam = 'spam',
  Offensive = 'offensive',
  OffTopic = 'off_topic',
  FalseInformation = 'false_information',
  Other = 'other',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false }, autoIndex: true })
export class ReviewReport {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'Review' })
  reviewId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  reporterId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(ReviewReportCategory),
  })
  category!: ReviewReportCategory;

  @Prop({ type: String, default: null, trim: true, maxlength: 500 })
  note!: string | null;
}

export type ReviewReportDocument = HydratedDocument<ReviewReport> & {
  createdAt: Date;
};

export const ReviewReportSchema = SchemaFactory.createForClass(ReviewReport);
ReviewReportSchema.index({ reviewId: 1, reporterId: 1 }, { unique: true });
