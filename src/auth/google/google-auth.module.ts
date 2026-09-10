import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../auth.module';
import { GoogleAuthService, GOOGLE_OAUTH_CLIENT } from './google-auth.service';

@Module({
  imports: [UsersModule, forwardRef(() => AuthModule), ConfigModule],
  providers: [
    {
      provide: GOOGLE_OAUTH_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const clientId =
          config.get<string>('google.clientId') ??
          process.env.GOOGLE_CLIENT_ID ??
          '';
        return new OAuth2Client(clientId);
      },
    },
    GoogleAuthService,
  ],
  exports: [GoogleAuthService],
})
export class GoogleAuthModule {}
