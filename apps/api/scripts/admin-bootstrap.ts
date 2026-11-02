import { Buffer } from 'node:buffer';
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import mongoose, { Schema } from 'mongoose';

const BCRYPT_COST = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface BootstrapUserDoc {
  name: string;
  email: string;
  passwordHash: string;
  role: 'buyer' | 'producer' | 'admin';
  producerStatus: string | null;
  producerApplication: Record<string, unknown> | null;
  producerRejectionReason: string | null;
  producerDecisionRevision: number;
  producerDecisionBy: mongoose.Types.ObjectId | null;
  producerDecisionAt: Date | null;
}

const BootstrapUserSchema = new Schema<BootstrapUserDoc>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ['buyer', 'producer', 'admin'],
    },
    producerStatus: {
      type: String,
      default: null,
    },
    producerApplication: {
      type: Schema.Types.Mixed,
      default: null,
    },
    producerRejectionReason: {
      type: String,
      default: null,
    },
    producerDecisionRevision: {
      type: Number,
      default: 0,
      min: 0,
    },
    producerDecisionBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    producerDecisionAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, autoIndex: true },
);
BootstrapUserSchema.index({ email: 1 }, { unique: true });

function printUsage(reason: string): never {
  console.error(`Error: ${reason}`);
  console.error(
    'Usage: pnpm --filter @dwc/api admin:bootstrap -- --name "<Full Name>" --email "<admin@example.com>" --password "<8..72 UTF-8 byte secret>"',
  );
  console.error(
    'Or provide ADMIN_BOOTSTRAP_NAME, ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD environment variables.',
  );
  process.exit(1);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

let parsed: ReturnType<typeof parseArgs>;
try {
  parsed = parseArgs({
    options: {
      name: { type: 'string' },
      email: { type: 'string' },
      password: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
} catch (error) {
  printUsage(
    error instanceof Error ? error.message : 'Invalid command arguments.',
  );
}

const rawName = parsed.values.name ?? process.env.ADMIN_BOOTSTRAP_NAME;
const rawEmail = parsed.values.email ?? process.env.ADMIN_BOOTSTRAP_EMAIL;
const password = parsed.values.password ?? process.env.ADMIN_BOOTSTRAP_PASSWORD;

if (typeof rawName !== 'string') {
  printUsage('Missing administrator name (--name or ADMIN_BOOTSTRAP_NAME).');
}
const name = rawName.trim();
if (name.length < 1 || name.length > 100) {
  printUsage('Administrator name must be between 1 and 100 characters.');
}

if (typeof rawEmail !== 'string') {
  printUsage('Missing administrator email (--email or ADMIN_BOOTSTRAP_EMAIL).');
}
const email = rawEmail.trim().toLowerCase();
if (email.length < 3 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
  printUsage(
    'Administrator email must be a valid email address (<= 254 chars).',
  );
}

if (typeof password !== 'string') {
  printUsage(
    'Missing administrator password (--password or ADMIN_BOOTSTRAP_PASSWORD).',
  );
}
const passwordBytes = Buffer.byteLength(password, 'utf8');
if (passwordBytes < 8 || passwordBytes > 72) {
  printUsage('Administrator password must be between 8 and 72 UTF-8 bytes.');
}

const mongoUri = process.env.MONGODB_URI;
if (typeof mongoUri !== 'string' || !mongoUri.trim()) {
  printUsage('MONGODB_URI must be configured in the environment.');
}

const connection = await mongoose
  .createConnection(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  })
  .asPromise();

try {
  const UserModel = connection.model<BootstrapUserDoc>(
    'User',
    BootstrapUserSchema,
  );
  await UserModel.init();

  const existing = await UserModel.findOne({ email }).select('role email');
  if (existing) {
    console.error(
      `Refusing to bootstrap admin: an account with email ${email} already exists (role: ${existing.role}). Existing users are preserved.`,
    );
    process.exitCode = 1;
  } else {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    try {
      const created = await UserModel.create({
        name,
        email,
        passwordHash,
        role: 'admin',
        producerStatus: null,
        producerApplication: null,
        producerRejectionReason: null,
        producerDecisionRevision: 0,
        producerDecisionBy: null,
        producerDecisionAt: null,
      });
      console.log(
        `Created administrator account: id=${created._id.toString()} name="${created.name}" email=${created.email}`,
      );
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        console.error(
          `Refusing to bootstrap admin: an account with email ${email} already exists. Existing users are preserved.`,
        );
        process.exitCode = 1;
      } else {
        throw error;
      }
    }
  }
} finally {
  await connection.close();
}
