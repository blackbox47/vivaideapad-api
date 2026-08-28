import {
  USER_ROLES,
  isUserRole,
  USER_ROLE_LEVEL,
  rolesAtOrAbove,
} from './user.entity';

/**
 * Locks the wire encoding of user roles in the database column and JWT
 * payload. If this test fails, any in-flight database has rows that mean
 * something different to old vs new code. Run a data migration before
 * re-running this suite.
 *
 * Encoding (effective 2026-08 renumbering):
 *   1 = SUPERADMIN
 *   2 = ADMINISTRATOR
 *   3 = CONTRIBUTOR
 *
 * Hierarchy (USER_ROLE_LEVEL):
 *   CONTRIBUTOR   = 1 (lowest)
 *   ADMINISTRATOR = 2
 *   SUPERADMIN    = 3 (highest)
 */
describe('USER_ROLES wire encoding', () => {
  it('super admin = 1', () => {
    expect(USER_ROLES.SUPERADMIN).toBe(1);
  });

  it('administrator = 2', () => {
    expect(USER_ROLES.ADMINISTRATOR).toBe(2);
  });

  it('contributor = 3', () => {
    expect(USER_ROLES.CONTRIBUTOR).toBe(3);
  });

  it('isUserRole accepts only {1, 2, 3}', () => {
    expect(isUserRole(1)).toBe(true);
    expect(isUserRole(2)).toBe(true);
    expect(isUserRole(3)).toBe(true);
    expect(isUserRole(0)).toBe(false);
    expect(isUserRole(4)).toBe(false);
    expect(isUserRole('1')).toBe(false);
  });
});

describe('USER_ROLE_LEVEL hierarchy', () => {
  it('contributor is the lowest level (1)', () => {
    expect(USER_ROLE_LEVEL[USER_ROLES.CONTRIBUTOR]).toBe(1);
  });

  it('administrator is level 2', () => {
    expect(USER_ROLE_LEVEL[USER_ROLES.ADMINISTRATOR]).toBe(2);
  });

  it('super admin is the highest level (3)', () => {
    expect(USER_ROLE_LEVEL[USER_ROLES.SUPERADMIN]).toBe(3);
  });

  it('super admin outranks administrator', () => {
    expect(USER_ROLE_LEVEL[USER_ROLES.SUPERADMIN]).toBeGreaterThan(
      USER_ROLE_LEVEL[USER_ROLES.ADMINISTRATOR],
    );
    expect(USER_ROLE_LEVEL[USER_ROLES.ADMINISTRATOR]).toBeGreaterThan(
      USER_ROLE_LEVEL[USER_ROLES.CONTRIBUTOR],
    );
  });
});

describe('rolesAtOrAbove', () => {
  it('@Roles(CONTRIBUTOR) admits everyone', () => {
    expect(new Set(rolesAtOrAbove(USER_ROLES.CONTRIBUTOR))).toEqual(
      new Set([
        USER_ROLES.ADMINISTRATOR,
        USER_ROLES.CONTRIBUTOR,
        USER_ROLES.SUPERADMIN,
      ]),
    );
  });

  it('@Roles(ADMINISTRATOR) admits ADMINISTRATOR + SUPERADMIN', () => {
    expect(new Set(rolesAtOrAbove(USER_ROLES.ADMINISTRATOR))).toEqual(
      new Set([USER_ROLES.ADMINISTRATOR, USER_ROLES.SUPERADMIN]),
    );
  });

  it('@Roles(SUPERADMIN) admits only SUPERADMIN', () => {
    expect(rolesAtOrAbove(USER_ROLES.SUPERADMIN)).toEqual([
      USER_ROLES.SUPERADMIN,
    ]);
  });
});
