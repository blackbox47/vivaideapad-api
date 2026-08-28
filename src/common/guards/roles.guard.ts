import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators/roles.decorator';
import {
  type UserRole,
  USER_ROLE_LEVEL,
  rolesAtOrAbove,
} from '../../users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{
      user?: { role?: UserRole };
    }>();
    const userRole = req.user?.role;
    if (userRole === undefined) {
      throw new ForbiddenException('No role on request');
    }

    // Hierarchical RBAC: each required role admits any user at or above its
    // level. So `@Roles(USER_ROLES.ADMINISTRATOR)` also admits SUPERADMIN.
    const userLevel = USER_ROLE_LEVEL[userRole];
    const admitted = required.some((r) => userLevel >= USER_ROLE_LEVEL[r]);
    if (!admitted) {
      throw new ForbiddenException(
        `Required role(s): ${required.join(', ')}; got: ${userRole}`,
      );
    }
    return true;
  }

  /**
   * Exposed for tests. Reflects the same hierarchy the guard enforces.
   */
  static isAuthorized(userRole: UserRole, required: UserRole[]): boolean {
    const level = USER_ROLE_LEVEL[userRole];
    return required.some((r) => level >= USER_ROLE_LEVEL[r]);
  }

  /** Exposed for tests/diagnostics. */
  static admittedRolesFor(required: UserRole[]): UserRole[] {
    const seen = new Set<UserRole>();
    for (const r of required) {
      for (const r2 of rolesAtOrAbove(r)) seen.add(r2);
    }
    return [...seen];
  }
}
