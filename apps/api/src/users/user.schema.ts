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

export enum BuyerStatus {
  Active = 'active',
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

/** Buyer's default delivery address; checkout pre-fills it. */
@Schema({ _id: false })
export class SavedAddress {
  @Prop({ required: true, trim: true, minlength: 3, maxlength: 200 })
  street!: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  city!: string;

  @Prop({ required: true, trim: true, minlength: 3, maxlength: 20 })
  postalCode!: string;
}

export const SavedAddressSchema = SchemaFactory.createForClass(SavedAddress);

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

  /** Private S3 key of the profile picture; null shows initials. */
  @Prop({ type: String, default: null })
  avatarKey!: string | null;

  @Prop({ type: String, trim: true, maxlength: 20, default: null })
  phone!: string | null;

  @Prop({ type: SavedAddressSchema, default: null })
  deliveryAddress!: SavedAddress | null;

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

  @Prop({
    type: String,
    enum: Object.values(BuyerStatus),
    default: BuyerStatus.Active,
  })
  buyerStatus!: BuyerStatus;

  @Prop({ type: String, trim: true, maxlength: 500, default: null })
  buyerSuspensionReason!: string | null;

  @Prop({ type: Number, default: 0, min: 0 })
  buyerDecisionRevision!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  buyerEligibilityRevision!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  buyerDecisionBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  buyerDecisionAt!: Date | null;
}

export type UserDocument = HydratedDocument<User> & {
  createdAt?: Date;
  updatedAt?: Date;
};
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, createdAt: -1, _id: -1 });
UserSchema.index({ producerStatus: 1, createdAt: -1, _id: -1 });
UserSchema.index({ role: 1, producerStatus: 1, createdAt: -1, _id: -1 });
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
