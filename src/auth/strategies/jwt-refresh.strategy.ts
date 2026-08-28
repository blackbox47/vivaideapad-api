import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import type { UserRole } from '../../users/entities/user.entity';
import { User } from '../../users/entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
  type: 'refresh';
  role: UserRole;
}

export const JWT_REFRESH_NAME = 'jwt-refresh';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  JWT_REFRESH_NAME,
) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {
    const secret = config.get<string>('jwt.refreshSecret');
    if (!secret) throw new Error('jwt.refreshSecret must be set');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtRefreshPayload) {
    if (payload.type !== 'refresh') return null;
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) return null;
    const stored = await this.refreshTokens.findOne({
      where: { id: payload.jti, userId: payload.sub },
    });
    if (!stored) return null;
    if (stored.revokedAt) return null;
    if (stored.expiresAt.getTime() < Date.now()) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      accessStatus: user.accessStatus,
      jti: stored.id,
      tokenHash: stored.tokenHash,
    };
  }
}
