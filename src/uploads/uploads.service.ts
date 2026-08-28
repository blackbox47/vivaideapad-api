import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';

import { ApiException } from '../common/exceptions/api-exception';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export interface StoredAttachment {
  url: string;
  mime_type: string;
  size: number;
  original_name: string;
  stored_path: string;
}

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  async storeAttachment(file: {
    originalname: string;
    mimetype: string;
    size: number;
    path: string;
  }): Promise<StoredAttachment> {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      // Best-effort cleanup.
      await fs.unlink(file.path).catch(() => undefined);
      throw ApiException.validation(`Unsupported file type: ${file.mimetype}`);
    }
    const maxBytes = this.config.get<number>('uploads.maxBytes')!;
    if (file.size > maxBytes) {
      await fs.unlink(file.path).catch(() => undefined);
      throw ApiException.validation(
        `File too large (${file.size} > ${maxBytes})`,
      );
    }

    const uploadDir = this.config.get<string>('uploads.dir')!;
    const now = new Date();
    const yyyy = now.getUTCFullYear().toString();
    const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const subdir = join(uploadDir, yyyy, mm);
    await fs.mkdir(subdir, { recursive: true });

    const safeExt = extname(file.originalname)
      .toLowerCase()
      .replace(/[^.\w]/g, '');
    const storedName = `${randomUUID()}${safeExt}`;
    const targetPath = join(subdir, storedName);
    await fs.rename(file.path, targetPath).catch(async (err) => {
      // rename can fail across filesystems — fall back to copy + unlink.
      await fs.copyFile(file.path, targetPath);
      await fs.unlink(file.path).catch(() => undefined);
      void err;
    });

    const publicPrefix = this.config.get<string>('uploads.publicPrefix')!;
    const url = `${publicPrefix}/${yyyy}/${mm}/${storedName}`;

    return {
      url,
      mime_type: file.mimetype,
      size: file.size,
      original_name: file.originalname,
      stored_path: targetPath,
    };
  }
}
