import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import {
  ApiException,
  ApiErrorBody,
} from '../../common/exceptions/api-exception';
import { UsersService } from '../../users/users.service';
import { User, USER_ROLES } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';
import { GoogleAuthService, GOOGLE_OAUTH_CLIENT } from './google-auth.service';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let mockOAuthClient: { verifyIdToken: jest.Mock };
  let mockUsersService: {
    findByEmail: jest.Mock;
    createGoogleIdentity: jest.Mock;
    setGoogleId: jest.Mock;
  };
  let mockAuthService: {
    signInForExistingUser: jest.Mock;
  };

  const mockTokens = {
    access_token: 'access-123',
    refresh_token: 'refresh-123',
    token_type: 'Bearer' as const,
    expires_in: 900,
    user: {
      id: 'u-1',
      email: 'creator@example.com',
      display_name: 'Creator Name',
      avatar_url: 'https://example.com/avatar.jpg',
      role: USER_ROLES.CONTRIBUTOR,
      access_status: 'invited',
    },
  };

  beforeEach(async () => {
    mockOAuthClient = {
      verifyIdToken: jest.fn(),
    };

    mockUsersService = {
      findByEmail: jest.fn(),
      createGoogleIdentity: jest.fn(),
      setGoogleId: jest.fn(),
    };

    mockAuthService = {
      signInForExistingUser: jest.fn().mockResolvedValue(mockTokens),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-client-id'),
          },
        },
        {
          provide: GOOGLE_OAUTH_CLIENT,
          useValue: mockOAuthClient,
        },
      ],
    }).compile();

    service = module.get<GoogleAuthService>(GoogleAuthService);
  });

  it('should sign in a new creator user successfully', async () => {
    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'creator@example.com',
        email_verified: true,
        name: 'Creator Name',
        picture: 'https://example.com/avatar.jpg',
      }),
    });
    mockUsersService.findByEmail.mockResolvedValue(null);

    const newUser: Partial<User> = {
      id: 'u-new',
      email: 'creator@example.com',
      googleId: 'google-sub-1',
      displayName: 'Creator Name',
      avatarUrl: 'https://example.com/avatar.jpg',
      role: USER_ROLES.CONTRIBUTOR,
      accessStatus: 'invited',
    };
    mockUsersService.createGoogleIdentity.mockResolvedValue(newUser);

    const result = await service.signIn({ credential: 'valid-token' });

    expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
      'creator@example.com',
    );
    expect(mockUsersService.createGoogleIdentity).toHaveBeenCalledWith({
      email: 'creator@example.com',
      googleId: 'google-sub-1',
      displayName: 'Creator Name',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
    expect(mockAuthService.signInForExistingUser).toHaveBeenCalledWith(
      newUser,
      undefined,
    );
    expect(result).toEqual(mockTokens);
  });

  it('should auto-link existing creator account when googleId is null', async () => {
    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-2',
        email: 'creator@example.com',
        email_verified: true,
        name: 'Creator Name',
      }),
    });

    const existingUser: Partial<User> = {
      id: 'u-existing',
      email: 'creator@example.com',
      googleId: null,
      role: USER_ROLES.CONTRIBUTOR,
      accessStatus: 'active',
    };
    mockUsersService.findByEmail.mockResolvedValue(existingUser);

    const result = await service.signIn({ credential: 'valid-token' });

    expect(mockUsersService.setGoogleId).toHaveBeenCalledWith(
      'u-existing',
      'google-sub-2',
    );
    expect(mockAuthService.signInForExistingUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-existing', googleId: 'google-sub-2' }),
      undefined,
    );
    expect(result).toEqual(mockTokens);
  });

  it('should sign in existing creator account with matching googleId', async () => {
    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-matching',
        email: 'creator@example.com',
        email_verified: true,
      }),
    });

    const existingUser: Partial<User> = {
      id: 'u-existing',
      email: 'creator@example.com',
      googleId: 'google-sub-matching',
      role: USER_ROLES.CONTRIBUTOR,
      accessStatus: 'active',
    };
    mockUsersService.findByEmail.mockResolvedValue(existingUser);

    const result = await service.signIn({ credential: 'valid-token' });

    expect(mockUsersService.setGoogleId).not.toHaveBeenCalled();
    expect(mockAuthService.signInForExistingUser).toHaveBeenCalledWith(
      existingUser,
      undefined,
    );
    expect(result).toEqual(mockTokens);
  });

  it('should reject with 401 if Google token verification fails', async () => {
    mockOAuthClient.verifyIdToken.mockRejectedValue(
      new Error('Invalid token signature'),
    );

    await expect(service.signIn({ credential: 'bad-token' })).rejects.toThrow(
      ApiException,
    );
  });

  it('should reject with 403 google_email_not_verified if email is not verified', async () => {
    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-3',
        email: 'creator@example.com',
        email_verified: false,
      }),
    });

    try {
      await service.signIn({ credential: 'token-unverified' });
      fail('Expected to throw ApiException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiException);
      const apiErr = err as ApiException;
      expect(apiErr.getStatus()).toBe(403);
      const res = apiErr.getResponse() as ApiErrorBody;
      expect(res.error).toEqual(
        expect.objectContaining({
          code: 'google_email_not_verified',
          message: 'Google account email is not verified',
        }),
      );
    }
  });

  it('should reject with 403 admin_required if existing user has an admin role', async () => {
    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-4',
        email: 'admin@example.com',
        email_verified: true,
      }),
    });

    const adminUser: Partial<User> = {
      id: 'u-admin',
      email: 'admin@example.com',
      googleId: null,
      role: USER_ROLES.ADMINISTRATOR,
      accessStatus: 'active',
    };
    mockUsersService.findByEmail.mockResolvedValue(adminUser);

    try {
      await service.signIn({ credential: 'valid-token' });
      fail('Expected to throw ApiException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiException);
      const apiErr = err as ApiException;
      expect(apiErr.getStatus()).toBe(403);
      const res = apiErr.getResponse() as ApiErrorBody;
      expect(res.error).toEqual(
        expect.objectContaining({
          code: 'admin_required',
          message: 'Admin accounts must use email and password',
        }),
      );
    }
  });

  it('should reject with 409 google_account_conflict if user is linked to another Google account', async () => {
    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-different',
        email: 'creator@example.com',
        email_verified: true,
      }),
    });

    const linkedUser: Partial<User> = {
      id: 'u-linked',
      email: 'creator@example.com',
      googleId: 'original-google-sub',
      role: USER_ROLES.CONTRIBUTOR,
      accessStatus: 'active',
    };
    mockUsersService.findByEmail.mockResolvedValue(linkedUser);

    try {
      await service.signIn({ credential: 'valid-token' });
      fail('Expected to throw ApiException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiException);
      const apiErr = err as ApiException;
      expect(apiErr.getStatus()).toBe(409);
      const res = apiErr.getResponse() as ApiErrorBody;
      expect(res.error).toEqual(
        expect.objectContaining({
          code: 'google_account_conflict',
          message: 'This email is already linked to a different Google account',
        }),
      );
    }
  });
});
