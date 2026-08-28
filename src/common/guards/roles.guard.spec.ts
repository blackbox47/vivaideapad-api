import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { ROLES_KEY, IS_PUBLIC_KEY } from '../decorators/roles.decorator';
import {
  USER_ROLES,
  USER_ROLE_LEVEL,
  type UserRole,
} from '../../users/entities/user.entity';
import { RolesGuard } from './roles.guard';

/**
 * Locks the hierarchical RBAC contract enforced by RolesGuard.
 *
 * If these tests fail, callers are about to be silently over- or under-
 * authorized — this is the single source of truth that the @Roles decorator
 * admits any user at or above the listed role's level.
 */
describe('RolesGuard (hierarchical RBAC)', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  // Helper: build a fake ExecutionContext with the given (role) req.user
  // and the (handler/class) metadata the guard will read.
  const buildContext = (
    role: UserRole | undefined,
    meta: { isPublic?: boolean; required?: UserRole[] } = {},
  ): ExecutionContext => {
    const handler = function namedHandler() {};
    const klass = class namedClass {};
    if (meta.isPublic !== undefined) {
      Reflect.defineMetadata(IS_PUBLIC_KEY, meta.isPublic, handler);
    }
    if (meta.required) {
      Reflect.defineMetadata(ROLES_KEY, meta.required, handler);
    }
    return {
      getHandler: () => handler,
      getClass: () => klass,
      switchToHttp: () => ({
        getRequest: () => ({ user: role !== undefined ? { role } : {} }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();
    guard = moduleRef.get(RolesGuard);
    reflector = moduleRef.get(Reflector);
  });

  describe('pure hierarchy table (RolesGuard.isAuthorized)', () => {
    it.each([
      // [required, user, expectedAdmit]
      [[USER_ROLES.ADMINISTRATOR], USER_ROLES.ADMINISTRATOR, true],
      [[USER_ROLES.ADMINISTRATOR], USER_ROLES.SUPERADMIN, true],
      [[USER_ROLES.ADMINISTRATOR], USER_ROLES.CONTRIBUTOR, false],

      [[USER_ROLES.SUPERADMIN], USER_ROLES.SUPERADMIN, true],
      [[USER_ROLES.SUPERADMIN], USER_ROLES.ADMINISTRATOR, false],

      [[USER_ROLES.CONTRIBUTOR], USER_ROLES.CONTRIBUTOR, true],
      [[USER_ROLES.CONTRIBUTOR], USER_ROLES.ADMINISTRATOR, true],
      [[USER_ROLES.CONTRIBUTOR], USER_ROLES.SUPERADMIN, true],

      // Multi-required: any match admits.
      [
        [USER_ROLES.ADMINISTRATOR, USER_ROLES.CONTRIBUTOR],
        USER_ROLES.SUPERADMIN,
        true,
      ],
      [
        [USER_ROLES.ADMINISTRATOR, USER_ROLES.SUPERADMIN],
        USER_ROLES.CONTRIBUTOR,
        false,
      ],
    ] as Array<[UserRole[], UserRole, boolean]>)(
      'required=%j, user=%j → %s',
      (required, user, expected) => {
        expect(RolesGuard.isAuthorized(user, required)).toBe(expected);
      },
    );
  });

  describe('canActivate integration', () => {
    it('admits a SUPERADMIN when @Roles(ADMINISTRATOR) is set (the user-reported bug)', () => {
      const ctx = buildContext(USER_ROLES.SUPERADMIN, {
        required: [USER_ROLES.ADMINISTRATOR],
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('admits an ADMINISTRATOR when @Roles(ADMINISTRATOR) is set', () => {
      const ctx = buildContext(USER_ROLES.ADMINISTRATOR, {
        required: [USER_ROLES.ADMINISTRATOR],
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects a CONTRIBUTOR when @Roles(ADMINISTRATOR) is set', () => {
      const ctx = buildContext(USER_ROLES.CONTRIBUTOR, {
        required: [USER_ROLES.ADMINISTRATOR],
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('returns true when @Public() is set, regardless of role', () => {
      const ctx = buildContext(undefined, { isPublic: true });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('returns true when no @Roles is set (any authenticated user)', () => {
      const ctx = buildContext(USER_ROLES.CONTRIBUTOR);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('throws ForbiddenException when req.user has no role', () => {
      const ctx = buildContext(undefined, {
        required: [USER_ROLES.ADMINISTRATOR],
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('level map sanity', () => {
    it('level ordering is monotonically increasing from CONTRIBUTOR → SUPERADMIN', () => {
      expect(USER_ROLE_LEVEL[USER_ROLES.CONTRIBUTOR]).toBeLessThan(
        USER_ROLE_LEVEL[USER_ROLES.ADMINISTRATOR],
      );
      expect(USER_ROLE_LEVEL[USER_ROLES.ADMINISTRATOR]).toBeLessThan(
        USER_ROLE_LEVEL[USER_ROLES.SUPERADMIN],
      );
    });
  });

  // The reflector import is here so the linter doesn't strip it from the
  // testing module — the guard depends on it being injectable.
  it('reflector is wired', () => {
    expect(reflector).toBeDefined();
  });
});
