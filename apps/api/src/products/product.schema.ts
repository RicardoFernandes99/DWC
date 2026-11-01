import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum ProductUnit {
  Unit = 'unit',
  Bunch = 'bunch',
  Box = 'box',
  Jar = 'jar',
  Bottle = 'bottle',
  Bag = 'bag',
  Kg = 'kg',
  G500 = 'g_500',
  G250 = 'g_250',
  L = 'l',
  Ml500 = 'ml_500',
}

export enum ProductCategory {
  Vegetables = 'vegetables',
  Fruits = 'fruits',
  Dairy = 'dairy',
  Eggs = 'eggs',
  Meat = 'meat',
  Bakery = 'bakery',
  Pantry = 'pantry',
  Beverages = 'beverages',
  Other = 'other',
}

export enum ProductionMethod {
  Organic = 'organic',
  Sustainable = 'sustainable',
  Conventional = 'conventional',
  Artisanal = 'artisanal',
  Biodynamic = 'biodynamic',
}

export enum ProductSeason {
  Spring = 'spring',
  Summer = 'summer',
  Autumn = 'autumn',
  Winter = 'winter',
  YearRound = 'year_round',
}

@Schema({ _id: false })
export class ProductImageMetadata {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 256 })
  objectKey!: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 64 })
  mimeType!: string;

  @Prop({ required: true, min: 1, max: 10_485_760 })
  sizeBytes!: number;

  @Prop({ required: true, min: 1, max: 10_000 })
  width!: number;

  @Prop({ required: true, min: 1, max: 10_000 })
  height!: number;

  @Prop({ required: true })
  uploadedAt!: Date;
}

export const ProductImageMetadataSchema =
  SchemaFactory.createForClass(ProductImageMetadata);

@Schema({ timestamps: true, autoIndex: true })
export class Product {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
  })
  producerId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 120 })
  name!: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 2000 })
  description!: string;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(ProductCategory),
  })
  category!: ProductCategory;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(ProductionMethod),
  })
  productionMethod!: ProductionMethod;

  @Prop({
    required: true,
    type: [String],
    enum: Object.values(ProductSeason),
    validate: {
      validator: (values: unknown) =>
        Array.isArray(values) &&
        values.length >= 1 &&
        values.length <= 5 &&
        new Set(values).size === values.length,
      message:
        'Product seasons must be a non-empty deduplicated list of 1 to 5 valid seasons.',
    },
  })
  seasons!: ProductSeason[];

  @Prop({ required: true, min: 1, max: 10_000_000 })
  priceCents!: number;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(ProductUnit),
  })
  unit!: ProductUnit;

  @Prop({ required: true, min: 0, max: 1_000_000 })
  availableStock!: number;

  @Prop({ required: true, default: 0, min: 0, max: 1_000_000 })
  reservedStock!: number;

  @Prop({ required: true, min: 0, max: 1_000_000 })
  lowStockThreshold!: number;

  @Prop({ required: true, default: false })
  published!: boolean;

  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  @Prop({ type: Date, default: null })
  moderatedAt!: Date | null;

  @Prop({ type: String, trim: true, maxlength: 500, default: null })
  moderationReason!: string | null;

  @Prop({ type: ProductImageMetadataSchema, default: null })
  image!: ProductImageMetadata | null;

  @Prop({ required: true, default: 1, min: 1 })
  revision!: number;
}

export type ProductDocument = HydratedDocument<Product> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ producerId: 1, archivedAt: 1, createdAt: -1 });
ProductSchema.index({
  published: 1,
  archivedAt: 1,
  moderatedAt: 1,
  category: 1,
  createdAt: -1,
});
