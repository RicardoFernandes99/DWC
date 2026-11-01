import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum UserRole {
  Buyer = 'buyer',
  Producer = 'producer',
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
  locality!: string;

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
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
