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

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  name!: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
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
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
