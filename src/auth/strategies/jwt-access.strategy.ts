import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';

import type { UserRole } from '../../users/entities/user.entity';
import { User } from '../../users/entities/user.entity';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
}

export const JWT_ACCESS_NAME = 'jwt-access';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  JWT_ACCESS_NAME,
) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    const secret = config.get<string>('jwt.accessSecret');
    if (!secret) throw new Error('jwt.accessSecret must be set');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtAccessPayload) {
    if (payload.type !== 'access') return null;
    const user = await this.users.findOne({
      where: { id: payload.sub, deletedAt: IsNull() },
    });
    if (!user) return null;
    return {
      // Both naming styles are exposed for ergonomic consumption:
      // - `id` for the @CurrentUser() decorator + clean call sites.
      // - `sub` for legacy req.user.sub readers in services/guards.
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
      accessStatus: user.accessStatus,
    };
  }
}
