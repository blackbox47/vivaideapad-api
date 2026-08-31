import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';

import { cookieExtractor } from '../jwt-cookie-extractor';
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
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {
    const secret = config.get<string>('jwt.refreshSecret');
    if (!secret) throw new Error('jwt.refreshSecret must be set');
    // Extract from the refresh cookie; `validate` re-reads the raw cookie via
    // req.cookies for the bcrypt hash comparison.
    super({
      jwtFromRequest: cookieExtractor(
        config.get<string>('cookie.refreshName') ?? '',
      ),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtRefreshPayload,
  ): Promise<{
    id: string;
    sub: string;
    email: string;
    role: UserRole;
    accessStatus: string;
    jti: string;
    family: string;
    presentedToken: string;
  } | null> {
    if (payload.type !== 'refresh') return null;
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) return null;

    const refreshCookieName = this.config.get<string>('cookie.refreshName');
    const presentedToken = readCookie(req, refreshCookieName);
    if (!presentedToken) return null;

    const stored = await this.refreshTokens.findOne({
      where: { id: payload.jti, userId: payload.sub },
    });
    if (!stored) return null;
    if (stored.expiresAt.getTime() < Date.now()) return null;

    // Constant-time hash comparison. Even though `validate` runs after
    // passport has already verified the JWT signature, we re-check that
    // the *exact* token bytes the client presented match what we stored
    // when this row was issued. This is a defense-in-depth check against
    // any code path that might mint a refresh JWT without inserting a row.
    const matches = await bcrypt.compare(presentedToken, stored.tokenHash);
    if (!matches) return null;

    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
      accessStatus: user.accessStatus,
      jti: stored.id,
      family: stored.family,
      presentedToken,
    };
  }
}

function readCookie(req: Request, name: string | undefined): string | null {
  if (!name) return null;
  const raw = req.cookies?.[name];
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return raw;
}
