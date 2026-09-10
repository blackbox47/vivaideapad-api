import type { DataSource, Repository } from 'typeorm';
import { PayoutsService } from './payouts.service';
import { PayoutRequest } from './payout.entity';
import { User } from '../../users/entities/user.entity';
import type { AuditEventsService } from '../audit-events/audit-events.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { WalletService } from '../../contributor/wallet.service';

describe('PayoutsService', () => {
  let service: PayoutsService;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;
  let mockRepo: jest.Mocked<Partial<Repository<PayoutRequest>>>;
  let mockAudit: jest.Mocked<Partial<AuditEventsService>>;
  let mockNotify: jest.Mocked<Partial<NotificationsService>>;
  let mockWallet: jest.Mocked<Partial<WalletService>>;

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
      recordStandalone: jest.fn().mockResolvedValue(undefined),
    };
    mockNotify = {
      emit: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      publishCreated: jest.fn(),
    };
    mockWallet = {
      recordInTx: jest.fn().mockResolvedValue({}),
      summary: jest.fn(),
    };
    mockDataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    };

    service = new PayoutsService(
      mockDataSource as DataSource,
      mockRepo as Repository<PayoutRequest>,
      mockAudit as AuditEventsService,
      mockNotify as NotificationsService,
      mockWallet as WalletService,
    );
  });

  describe('process', () => {
    it('successfully marks a payout as paid with reference and notes', async () => {
      const payoutRow = {
        id: 'payout-123',
        userId: 'user-456',
        amount: '180.00',
        status: 'pending',
        method: 'Nagad',
        details: { account_number: '017•••88' },
        decisionNotes: null,
        processingReference: null,
        processedAt: null,
        processedBy: null,
        createdAt: new Date('2026-08-04'),
        updatedAt: new Date('2026-08-04'),
      };

      const ledgerRow = {
        id: 'ledger-789',
        reference: 'payout:payout-123',
        status: 'pending',
        postedAt: null,
      };

      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(payoutRow),
      };

      const mockPayoutRepoInTx = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      const mockLedgerRepoInTx = {
        findOne: jest.fn().mockResolvedValue(ledgerRow),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      const mockUserRepoInTx = {
        find: jest.fn().mockResolvedValue([
          {
            id: 'user-456',
            displayName: 'Jonas Lee',
            email: 'jonas@example.com',
          },
        ]),
      };

      mockDataSource.transaction = jest
        .fn()
        .mockImplementation(
          (
            callback: (manager: {
              getRepository: (target: unknown) => unknown;
            }) => Promise<unknown>,
          ) => {
            const fakeManager = {
              getRepository: jest
                .fn()
                .mockImplementation((entityClass: unknown) => {
                  if (entityClass === PayoutRequest) {
                    return mockPayoutRepoInTx;
                  }
                  if (entityClass === User) {
                    return mockUserRepoInTx;
                  }
                  return mockLedgerRepoInTx;
                }),
            };
            return callback(fakeManager);
          },
        );

      const result = await service.process({
        id: 'payout-123',
        actorId: 'admin-1',
        body: {
          action: 'mark_paid',
          reference: 'TX93K2',
          note: 'Processed via Nagad corporate',
        },
      });

      expect(result.status).toBe('paid');
      expect(result.processing_reference).toBe('TX93K2');
      expect(result.decision_notes).toBe('Processed via Nagad corporate');
      expect(result.display_name).toBe('Jonas Lee');
      expect(ledgerRow.status).toBe('posted');
      expect(mockNotify.publishCreated).toHaveBeenCalled();
    });

    it('successfully rejects a payout with note', async () => {
      const payoutRow = {
        id: 'payout-124',
        userId: 'user-456',
        amount: '180.00',
        status: 'pending',
        method: 'Nagad',
        details: null,
        decisionNotes: null,
        processingReference: null,
        processedAt: null,
        processedBy: null,
        createdAt: new Date('2026-08-04'),
        updatedAt: new Date('2026-08-04'),
      };

      const ledgerRow = {
        id: 'ledger-790',
        reference: 'payout:payout-124',
        status: 'pending',
      };

      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(payoutRow),
      };

      const mockPayoutRepoInTx = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      const mockLedgerRepoInTx = {
        findOne: jest.fn().mockResolvedValue(ledgerRow),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      const mockUserRepoInTx = {
        find: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.transaction = jest
        .fn()
        .mockImplementation(
          (
            callback: (manager: {
              getRepository: (target: unknown) => unknown;
            }) => Promise<unknown>,
          ) => {
            const fakeManager = {
              getRepository: jest
                .fn()
                .mockImplementation((entityClass: unknown) => {
                  if (entityClass === PayoutRequest) {
                    return mockPayoutRepoInTx;
                  }
                  if (entityClass === User) {
                    return mockUserRepoInTx;
                  }
                  return mockLedgerRepoInTx;
                }),
            };
            return callback(fakeManager);
          },
        );

      const result = await service.process({
        id: 'payout-124',
        actorId: 'admin-1',
        body: {
          action: 'reject',
          note: 'Invalid account number',
        },
      });

      expect(result.status).toBe('rejected');
      expect(result.decision_notes).toBe('Invalid account number');
      expect(ledgerRow.status).toBe('reversed');
      expect(mockNotify.publishCreated).toHaveBeenCalled();
    });
  });
});
