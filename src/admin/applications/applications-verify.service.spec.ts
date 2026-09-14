import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { HttpStatus } from '@nestjs/common';

import { ApiException, ApiErrorBody } from '../../common/exceptions/api-exception';
import { UsersService } from '../../users/users.service';
import { User, USER_ROLES } from '../../users/entities/user.entity';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Category } from '../categories/category.entity';
import { Concept } from '../concepts/concept.entity';
import { Application } from './application.entity';
import { ApplicationsService } from './applications.service';
import { MAILER_SERVICE } from '../../auth/mailer/mailer.service';

describe('ApplicationsService verify-email flow', () => {
  let service: ApplicationsService;
  let mockUsersService: {
    findByVerificationToken: jest.Mock;
    clearVerificationToken: jest.Mock;
  };
  let mockAppRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let mockCategoryRepo: {
    findOne: jest.Mock;
  };
  let mockConceptRepo: {
    findOne: jest.Mock;
  };
  let mockAudit: {
    recordStandalone: jest.Mock;
  };
  let mockMailer: {
    sendVerificationLink: jest.Mock;
    sendApprovalInvite: jest.Mock;
  };

  const pendingUser: Partial<User> = {
    id: 'user-1',
    email: 'creator@example.com',
    displayName: 'Creator',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'pending_review',
    verificationToken: 'tok-abc',
    verificationTokenExpiresAt: new Date(Date.now() + 60_000),
  };

  beforeEach(async () => {
    mockUsersService = {
      findByVerificationToken: jest.fn(),
      clearVerificationToken: jest.fn().mockResolvedValue(undefined),
    };
    mockAppRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => ({
        ...row,
        id: 'app-1',
        createdAt: new Date('2026-09-14T00:00:00.000Z'),
        updatedAt: new Date('2026-09-14T00:00:00.000Z'),
      })),
    };
    mockCategoryRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Network',
      }),
    };
    mockConceptRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: '22222222-2222-4222-8222-222222222222',
        categoryId: '11111111-1111-4111-8111-111111111111',
        title: 'Onboarding topic',
        isOnboarding: true,
        status: 'active',
        deletedAt: null,
      }),
    };
    mockAudit = {
      recordStandalone: jest.fn().mockResolvedValue(undefined),
    };
    mockMailer = {
      sendVerificationLink: jest.fn().mockResolvedValue(undefined),
      sendApprovalInvite: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: getDataSourceToken(), useValue: {} },
        { provide: getRepositoryToken(Application), useValue: mockAppRepo },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Category), useValue: mockCategoryRepo },
        { provide: getRepositoryToken(Concept), useValue: mockConceptRepo },
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuditEventsService, useValue: mockAudit },
        {
          provide: NotificationsService,
          useValue: { emit: jest.fn(), publishCreated: jest.fn() },
        },
        { provide: MAILER_SERVICE, useValue: mockMailer },
      ],
    }).compile();

    service = module.get(ApplicationsService);
  });

  it('verifyEmailToken returns identity when token is valid', async () => {
    mockUsersService.findByVerificationToken.mockResolvedValue(pendingUser);

    const result = await service.verifyEmailToken('tok-abc');

    expect(result).toEqual({
      email: 'creator@example.com',
      display_name: 'Creator',
      access_status: 'pending_review',
      application_status: null,
    });
  });

  it('verifyEmailToken rejects expired tokens', async () => {
    mockUsersService.findByVerificationToken.mockResolvedValue({
      ...pendingUser,
      verificationTokenExpiresAt: new Date(Date.now() - 1_000),
    });

    try {
      await service.verifyEmailToken('tok-abc');
      fail('Expected ApiException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiException);
      const apiErr = err as ApiException;
      expect(apiErr.getStatus()).toBe(HttpStatus.GONE);
      expect((apiErr.getResponse() as ApiErrorBody).error.code).toBe(
        'verification_token_expired',
      );
    }
  });

  it('submitViaVerificationToken creates an application and clears the token', async () => {
    mockUsersService.findByVerificationToken.mockResolvedValue(pendingUser);

    const result = await service.submitViaVerificationToken({
      token: 'tok-abc',
      concept_id: '22222222-2222-4222-8222-222222222222',
      idea_title: 'Coverage map',
      idea_summary: 'Short pitch',
      idea_description: '<p>Let riders pin dead zones on a shared map.</p>',
      consent: true,
    });

    expect(result.reference_number).toMatch(/^APP-/);
    expect(result.application.idea_title).toBe('Onboarding topic');
    expect(result.application.concept_id).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(mockUsersService.clearVerificationToken).toHaveBeenCalledWith(
      'user-1',
    );
    expect(mockAudit.recordStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'application.submitted',
        context: expect.objectContaining({
          source: 'verify_email',
          concept_id: '22222222-2222-4222-8222-222222222222',
        }),
      }),
    );
  });

  it('submitViaVerificationToken rejects duplicate open applications', async () => {
    mockUsersService.findByVerificationToken.mockResolvedValue(pendingUser);
    mockAppRepo.findOne.mockResolvedValue({
      id: 'app-existing',
      status: 'submitted',
      referenceNumber: 'APP-EXISTING',
    });

    try {
      await service.submitViaVerificationToken({
        token: 'tok-abc',
        concept_id: '22222222-2222-4222-8222-222222222222',
        idea_title: 'Coverage map',
        idea_description: '<p>Let riders pin dead zones on a shared map.</p>',
        consent: true,
      });
      fail('Expected ApiException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiException);
      const apiErr = err as ApiException;
      expect(apiErr.getStatus()).toBe(HttpStatus.CONFLICT);
      expect((apiErr.getResponse() as ApiErrorBody).error.code).toBe(
        'application_already_submitted',
      );
    }
  });
});
