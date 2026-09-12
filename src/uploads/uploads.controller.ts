import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { promises as fs, createReadStream } from 'fs';
import { basename, extname, join, resolve, normalize } from 'path';
import type { Request, Response } from 'express';

import { Public } from '../common/decorators/roles.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ApiException } from '../common/exceptions/api-exception';
import { UploadsService } from './uploads.service';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

function buildContentDisposition(
  disposition: 'inline' | 'attachment',
  filename: string,
): string {
  const cleaned = filename
    .replace(/[\r\n]/g, '')
    .replace(/[/\\]/g, '')
    .trim()
    .slice(0, 200);
  const safe = cleaned || 'download';
  const fallback = safe.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAccessGuard)
  @Post('attachment')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single attachment file (multipart)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    description: 'Attachment stored',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        mime_type: { type: 'string' },
        size: { type: 'number' },
        original_name: { type: 'string' },
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw ApiException.validation('No file uploaded under field "file"');
    }
    const ua = req.headers['user-agent'] ?? '';
    void ua;
    const stored = await this.uploads.storeAttachment({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
    });
    return {
      url: stored.url,
      mime_type: stored.mime_type,
      size: stored.size,
      original_name: stored.original_name,
    };
  }

  @Public()
  @Get(['files/*', 'files/:year/:month/:filename'])
  @ApiOperation({ summary: 'Serve a stored attachment file' })
  async serve(
    @Param() params: Record<string, string>,
    @Query('download') downloadFlag?: string,
    @Query('filename') filename?: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const uploadDir = this.config.get<string>('uploads.dir')!;
    let rawPath =
      params['0'] ??
      (params.year && params.month && params.filename
        ? `${params.year}/${params.month}/${params.filename}`
        : '');

    if (!rawPath && req.originalUrl) {
      const match = req.originalUrl.match(/\/files\/(.+?)(\?.*)?$/);
      if (match) {
        rawPath = match[1];
      }
    }

    if (!rawPath && req.url) {
      const match = req.url.match(/\/files\/(.+?)(\?.*)?$/);
      if (match) {
        rawPath = match[1];
      }
    }

    if (!rawPath) {
      throw ApiException.notFound('File');
    }

    const rel = normalize(rawPath).replace(/^(\.\.[/\\])+/, '');
    const abs = resolve(join(uploadDir, rel));
    if (!abs.startsWith(resolve(uploadDir))) {
      throw ApiException.forbidden('path_traversal', 'Invalid path');
    }
    try {
      await fs.access(abs);
    } catch {
      throw ApiException.notFound('File');
    }

    const ext = extname(abs).toLowerCase();
    const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    const wantsDownload =
      downloadFlag === '1' || downloadFlag === 'true' || downloadFlag === 'download';
    const downloadName = filename?.trim() || basename(abs);
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      buildContentDisposition(wantsDownload ? 'attachment' : 'inline', downloadName),
    );
    createReadStream(abs).pipe(res);
  }
}
