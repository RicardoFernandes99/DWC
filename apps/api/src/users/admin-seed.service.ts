import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { User, UserRole } from './user.schema.js';

const BCRYPT_COST = 12;

/**
 * Local convenience: when ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are
 * set, make sure that administrator exists on every start. An existing account
 * with the same email is never changed or promoted.
 */
@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config
      .get<string>('ADMIN_BOOTSTRAP_EMAIL')
      ?.trim()
      .toLowerCase();
    const password = this.config.get<string>('ADMIN_BOOTSTRAP_PASSWORD');
    if (!email || !password) return;

    if (await this.users.exists({ email })) return;

    const name = this.config.get<string>('ADMIN_BOOTSTRAP_NAME')?.trim();
    try {
      await this.users.create({
        name: name || 'Administrator',
        email,
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        role: UserRole.Admin,
      });
      this.logger.log(`Seeded administrator account ${email}.`);
    } catch (error: unknown) {
      // A parallel start may have created it first; that is fine.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
}
