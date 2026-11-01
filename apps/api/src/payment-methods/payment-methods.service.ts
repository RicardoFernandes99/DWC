import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreatePaymentMethodDto,
  PaymentMethodResponseDto,
} from './payment-method.dto.js';
import {
  PaymentMethod,
  PaymentMethodDocument,
} from './payment-method.schema.js';

function isExpired(
  method: Pick<PaymentMethod, 'expiryMonth' | 'expiryYear'>,
  now = new Date(),
) {
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const expiryMonth = method.expiryYear * 12 + method.expiryMonth - 1;
  return expiryMonth < currentMonth;
}

function toResponse(method: PaymentMethodDocument): PaymentMethodResponseDto {
  return {
    id: method._id.toString(),
    last4: method.last4,
    expiryMonth: method.expiryMonth,
    expiryYear: method.expiryYear,
    expired: isExpired(method),
  };
}

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectModel(PaymentMethod.name)
    private readonly methods: Model<PaymentMethod>,
  ) {}

  async create(ownerId: string, input: CreatePaymentMethodDto) {
    if (isExpired(input))
      throw new BadRequestException(
        'Payment method expiry must be this month or later.',
      );
    const method = await this.methods.create({
      ownerId: new Types.ObjectId(ownerId),
      last4: input.last4,
      expiryMonth: input.expiryMonth,
      expiryYear: input.expiryYear,
    });
    return toResponse(method);
  }

  async list(ownerId: string) {
    const methods = await this.methods
      .find({ ownerId: new Types.ObjectId(ownerId) })
      .sort({ createdAt: -1, _id: -1 })
      .exec();
    return methods.map(toResponse);
  }

  findOwnedUnexpired(ownerId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.methods
      .findOne({
        _id: new Types.ObjectId(id),
        ownerId: new Types.ObjectId(ownerId),
      })
      .then((method) => (method && !isExpired(method) ? method : null));
  }
}
