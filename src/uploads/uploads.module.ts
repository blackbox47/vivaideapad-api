import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { extname } from 'path';
import { randomUUID } from 'crypto';

import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: diskStorage({
          destination: config.get<string>('uploads.dir')!,
          filename: (
            _req: Request,
            file: Express.Multer.File,
            cb: (error: Error | null, filename: string) => void,
          ) => {
            const safeExt = extname(file.originalname)
              .toLowerCase()
              .replace(/[^.\w]/g, '');
            cb(null, `${randomUUID()}${safeExt}`);
          },
        }),
        limits: {
          fileSize: config.get<number>('uploads.maxBytes')!,
        },
      }),
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService, MulterModule],
})
export class UploadsModule {}
