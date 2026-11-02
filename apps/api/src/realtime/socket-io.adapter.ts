import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ConfigService } from '@nestjs/config';
import type { ServerOptions } from 'socket.io';

export class SocketIoAdapter extends IoAdapter {
  private readonly webOrigin: string;

  constructor(app: INestApplication, config: ConfigService) {
    super(app);
    this.webOrigin = config.getOrThrow<string>('WEB_ORIGIN');
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const serverOptions = options ?? ({} as ServerOptions);
    serverOptions.cors = {
      ...serverOptions.cors,
      origin: this.webOrigin,
      credentials: true,
    };
    return super.createIOServer(port, serverOptions);
  }
}
