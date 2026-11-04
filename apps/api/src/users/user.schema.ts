import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum UserRole {
  Buyer = 'buyer',
  Producer = 'producer',
  Admin = 'admin',
}

export enum ProducerStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Suspended = 'suspended',
}

@Schema({ _id: false })
export class ProducerApplication {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 120 })
  farmName!: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 2000 })
  description!: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 120 })
  city!: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 240 })
  collectionAddress!: string;

  @Prop({ required: true, min: -90, max: 90 })
  latitude!: number;

  @Prop({ required: true, min: -180, max: 180 })
  longitude!: number;

  @Prop({ required: true })
  submittedAt!: Date;
}

export const ProducerApplicationSchema =
  SchemaFactory.createForClass(ProducerApplication);

@Schema({ timestamps: true, autoIndex: true })
export class User {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  name!: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254,
  })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, enum: Object.values(UserRole) })
  role!: UserRole;

  @Prop({
    type: String,
    enum: [...Object.values(ProducerStatus), null],
    default: null,
  })
  producerStatus!: ProducerStatus | null;

  @Prop({ type: ProducerApplicationSchema, default: null })
  producerApplication!: ProducerApplication | null;

  @Prop({ type: String, trim: true, maxlength: 500, default: null })
  producerRejectionReason!: string | null;

  @Prop({ type: String, trim: true, maxlength: 500, default: null })
  producerSuspensionReason!: string | null;

  @Prop({ type: Number, default: 0, min: 0 })
  producerDecisionRevision!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  auctionEligibilityRevision!: number;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    default: null,
  })
  producerDecisionBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  producerDecisionAt!: Date | null;
}

export type UserDocument = HydratedDocument<User> & {
  createdAt?: Date;
  updatedAt?: Date;
};
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({
  role: 1,
  producerStatus: 1,
  'producerApplication.submittedAt': -1,
});
UserSchema.index({
  role: 1,
  producerStatus: 1,
  'producerApplication.farmName': 1,
  _id: 1,
});
