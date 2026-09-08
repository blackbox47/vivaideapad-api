import 'reflect-metadata';

import { AppDataSource } from '../data-source';
import { PaymentMethod } from '../../admin/payment-methods/payment-method.entity';

const BKASH_CODE = 'bKash';
const BKASH_NAME = 'bKash';
const BKASH_DESCRIPTION = 'bKash mobile financial service';
const BKASH_ACCOUNT_HINT = '018•••42';
const BKASH_SORT_ORDER = 1;

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const repo = AppDataSource.getRepository(PaymentMethod);

    // Remove any payment methods other than bKash (soft or hard deleted rows included).
    const others = await repo.find({
      withDeleted: true,
      where: {},
    });

    const toRemove = others.filter((p) => p.code !== BKASH_CODE);
    if (toRemove.length > 0) {
      const ids = toRemove.map((p) => p.id);
      // Hard delete to keep the table containing only bKash.
      await repo.delete(ids);
      console.log(
        `  ✓ removed ${toRemove.length} non-bKash payment method(s): ${toRemove
          .map((p) => p.code)
          .join(', ')}`,
      );
    } else {
      console.log('  ↻ no non-bKash payment methods to remove');
    }

    // Ensure bKash exists.
    let bkash = await repo.findOne({
      where: { code: BKASH_CODE },
      withDeleted: true,
    });

    if (!bkash) {
      bkash = repo.create({
        code: BKASH_CODE,
        name: BKASH_NAME,
        description: BKASH_DESCRIPTION,
        accountHint: BKASH_ACCOUNT_HINT,
        isActive: true,
        sortOrder: BKASH_SORT_ORDER,
      });
      await repo.save(bkash);
      console.log(`  ✓ inserted bKash payment method`);
    } else {
      // Make sure bKash is active and undeleted.
      let changed = false;
      if (bkash.deletedAt) {
        bkash.deletedAt = null;
        changed = true;
      }
      if (bkash.isActive !== true) {
        bkash.isActive = true;
        changed = true;
      }
      if (bkash.name !== BKASH_NAME) {
        bkash.name = BKASH_NAME;
        changed = true;
      }
      if (bkash.description !== BKASH_DESCRIPTION) {
        bkash.description = BKASH_DESCRIPTION;
        changed = true;
      }
      if (bkash.accountHint !== BKASH_ACCOUNT_HINT) {
        bkash.accountHint = BKASH_ACCOUNT_HINT;
        changed = true;
      }
      if (bkash.sortOrder !== BKASH_SORT_ORDER) {
        bkash.sortOrder = BKASH_SORT_ORDER;
        changed = true;
      }
      if (changed) {
        await repo.save(bkash);
        console.log(`  ↻ updated existing bKash payment method`);
      } else {
        console.log(`  ↻ bKash payment method already exists`);
      }
    }

    const remaining = await repo.find({ withDeleted: true });
    console.log(
      `Payment methods now in table: ${remaining
        .map((p) => p.code)
        .join(', ')}`,
    );
    console.log('Payment method seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Payment method seed failed:', err);
  process.exit(1);
});
