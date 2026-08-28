import {
  Controller,
  Get,
  Param,
  Post,
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
import { join, resolve, normalize } from 'path';
import type { Request, Response } from 'express';

import { Public } from '../common/decorators/roles.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ApiException } from '../common/exceptions/api-exception';
import { UploadsService } from './uploads.service';

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
  @Get('files/*')
  @ApiOperation({ summary: 'Serve a stored attachment file' })
  async serve(@Param() params: { '0': string }, @Res() res: Response) {
    const uploadDir = this.config.get<string>('uploads.dir')!;
    const rel = normalize(params['0']).replace(/^(\.\.[/\\])+/, '');
    const abs = resolve(join(uploadDir, rel));
    if (!abs.startsWith(resolve(uploadDir))) {
      throw ApiException.forbidden('path_traversal', 'Invalid path');
    }
    try {
      await fs.access(abs);
    } catch {
      throw ApiException.notFound('File');
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    createReadStream(abs).pipe(res);
  }
}
