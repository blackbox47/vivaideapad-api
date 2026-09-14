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
        // MySQL `DATETIME` columns are zone-less: values are stored verbatim
        // and mysql2's connection `timezone` controls *only* how the JS Date is
        // serialized on the wire and parsed on read. Using 'Z' (UTC) means the
        // column stores the UTC instant's hour/minute digits, and a read with
        // 'Z' reconstructs the same UTC instant — no double shift. The browser
        // (or any client) renders the resulting ISO string in the user's zone.
        timezone: process.env.DB_TIMEZONE ?? 'Z',
        logging: ['error', 'warn'] as const,
      }),
    }),
  ],
})
export class DatabaseModule {}
