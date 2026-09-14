import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import {
  ApiException,
  ApiErrorBody,
} from '../../common/exceptions/api-exception';
import { UsersService } from '../../users/users.service';
import { User, USER_ROLES } from '../../users/entities/user.entity';
import { AuthService } from '../auth.service';
import { MAILER_SERVICE } from '../mailer/mailer.service';
import { GoogleAuthService, GOOGLE_OAUTH_CLIENT } from './google-auth.service';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let mockOAuthClient: { verifyIdToken: jest.Mock };
  let mockUsersService: {
    findByEmail: jest.Mock;
    createGoogleIdentity: jest.Mock;
    setGoogleId: jest.Mock;
    setVerificationToken: jest.Mock;
  };
  let mockAuthService: {
    signInForExistingUser: jest.Mock;
  };
  let mockMailer: {
    sendVerificationLink: jest.Mock;
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
      access_status: 'active',
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
      setVerificationToken: jest.fn().mockResolvedValue(undefined),
    };

    mockAuthService = {
      signInForExistingUser: jest.fn().mockResolvedValue(mockTokens),
    };

    mockMailer = {
      sendVerificationLink: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: MAILER_SERVICE,
          useValue: mockMailer,
        },
      ],
    }).compile();

    service = module.get<GoogleAuthService>(GoogleAuthService);
  });

  it('should create a pending_review user on first Google identity, email verify link, and block sign-in', async () => {
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
      accessStatus: 'pending_review',
    };
    mockUsersService.createGoogleIdentity.mockResolvedValue(newUser);

    try {
      await service.signIn({ credential: 'valid-token' });
      fail('Expected to throw ApiException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiException);
      const apiErr = err as ApiException;
      expect(apiErr.getStatus()).toBe(403);
      const res = apiErr.getResponse() as ApiErrorBody;
      expect(res.error).toEqual(
        expect.objectContaining({ code: 'account_pending_review' }),
      );
    }

    expect(mockUsersService.createGoogleIdentity).toHaveBeenCalledWith({
      email: 'creator@example.com',
      googleId: 'google-sub-1',
      displayName: 'Creator Name',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
    expect(mockUsersService.setVerificationToken).toHaveBeenCalledWith(
      'u-new',
      expect.any(String),
      expect.any(Date),
    );
    expect(mockMailer.sendVerificationLink).toHaveBeenCalledWith({
      email: 'creator@example.com',
      displayName: 'Creator Name',
      token: expect.any(String),
    });
    expect(mockAuthService.signInForExistingUser).not.toHaveBeenCalled();
  });

  it('should sign up a new Google user as pending_review and email a verification link', async () => {
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
      accessStatus: 'pending_review',
    };
    mockUsersService.createGoogleIdentity.mockResolvedValue(newUser);

    const result = await service.signUp({ credential: 'valid-token' });

    expect(result).toEqual({ email: 'creator@example.com' });
    expect(mockUsersService.setVerificationToken).toHaveBeenCalledWith(
      'u-new',
      expect.any(String),
      expect.any(Date),
    );
    expect(mockMailer.sendVerificationLink).toHaveBeenCalledWith({
      email: 'creator@example.com',
      displayName: 'Creator Name',
      token: expect.any(String),
    });
    expect(mockAuthService.signInForExistingUser).not.toHaveBeenCalled();
  });

  it('should reject Google sign-in for an existing pending_review user and re-send the verify link', async () => {
    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-pending',
        email: 'pending@example.com',
        email_verified: true,
      }),
    });

    const pendingUser: Partial<User> = {
      id: 'u-pending',
      email: 'pending@example.com',
      displayName: 'Pending User',
      googleId: 'google-sub-pending',
      role: USER_ROLES.CONTRIBUTOR,
      accessStatus: 'pending_review',
    };
    mockUsersService.findByEmail.mockResolvedValue(pendingUser);

    try {
      await service.signIn({ credential: 'valid-token' });
      fail('Expected to throw ApiException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiException);
      const apiErr = err as ApiException;
      expect(apiErr.getStatus()).toBe(403);
      expect((apiErr.getResponse() as ApiErrorBody).error.code).toBe(
        'account_pending_review',
      );
    }

    expect(mockUsersService.createGoogleIdentity).not.toHaveBeenCalled();
    expect(mockUsersService.setVerificationToken).toHaveBeenCalledWith(
      'u-pending',
      expect.any(String),
      expect.any(Date),
    );
    expect(mockMailer.sendVerificationLink).toHaveBeenCalledWith({
      email: 'pending@example.com',
      displayName: 'Pending User',
      token: expect.any(String),
    });
    expect(mockAuthService.signInForExistingUser).not.toHaveBeenCalled();
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
