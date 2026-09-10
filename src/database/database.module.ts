import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Global()
@Module({
  imports: [
    // forRootAsync so ConfigModule has already loaded `.env` into process.env /
    // ConfigService before these options are evaluated. A sync forRoot() reads
    // process.env at import time — before dotenv runs — and silently falls back
    // to the hardcoded defaults (e.g. port 3307).
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'vivaidea'),
        password: config.get<string>('DB_PASSWORD', 'vivaidea'),
        database: config.get<string>('DB_NAME', 'vivaidea'),
        autoLoadEntities: true,
        // Schema is owned by migrations. Set DB_SYNCHRONIZE=true only in
        // throwaway dev sandboxes; the real dev/prod workflow is
        // `pnpm migration:run`.
        synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
        charset: 'utf8mb4',
        timezone: 'Z',
        logging: ['error', 'warn'] as const,
      }),
    }),
  ],
})
export class DatabaseModule {}
