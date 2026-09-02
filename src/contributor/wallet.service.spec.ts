import { WalletService } from './wallet.service';
import { LedgerEntry } from './entities/ledger-entry.entity';
import type { Repository } from 'typeorm';

describe('WalletService', () => {
  describe('summary', () => {
    it('calculates available balance with pending payout holds deducted', async () => {
      const mockRawOne = {
        balance: '16400.00',
        pending: '10000.00',
        lifetime_credits: '26400.00',
        lifetime_debits: '0.00',
      };

      const qb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockRawOne),
      };

      const mockRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      } as unknown as Repository<LedgerEntry>;

      const service = new WalletService(mockRepo);
      const summary = await service.summary('user-123');

      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('l');
      expect(qb.where).toHaveBeenCalledWith('l.user_id = :uid', { uid: 'user-123' });
      expect(summary).toEqual({
        balance: '16400.00',
        pending: '10000.00',
        lifetime_credits: '26400.00',
        lifetime_debits: '0.00',
      });
    });

    it('returns default zero values when no entries exist', async () => {
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };

      const mockRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      } as unknown as Repository<LedgerEntry>;

      const service = new WalletService(mockRepo);
      const summary = await service.summary('user-empty');

      expect(summary).toEqual({
        balance: '0',
        pending: '0',
        lifetime_credits: '0',
        lifetime_debits: '0',
      });
    });
  });
});
