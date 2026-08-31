import 'reflect-metadata';
import * as bcrypt from 'bcrypt';

import { AppDataSource } from '../data-source';
import {
  User,
  UserRole,
  AccessStatus,
  USER_ROLES,
} from '../../users/entities/user.entity';
import { Category } from '../../admin/categories/category.entity';
import { Concept } from '../../admin/concepts/concept.entity';

interface SeedUser {
  email: string;
  displayName: string;
  role: UserRole;
  accessStatus: AccessStatus;
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'admin@viva.local',
    displayName: 'Viva Admin',
    role: USER_ROLES.ADMINISTRATOR,
    accessStatus: 'active',
  },
  {
    email: 'super@viva.local',
    displayName: 'Viva Superadmin',
    role: USER_ROLES.SUPERADMIN,
    accessStatus: 'active',
  },
  {
    email: 'contrib1@viva.local',
    displayName: 'Contrib One',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
  },
  {
    email: 'contrib2@viva.local',
    displayName: 'Contrib Two',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
  },
];

const DEFAULT_PASSWORD = 'ChangeMe!123';

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const userRepo = AppDataSource.getRepository(User);
    const categoryRepo = AppDataSource.getRepository(Category);
    const conceptRepo = AppDataSource.getRepository(Concept);

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    for (const u of SEED_USERS) {
      const existing = await userRepo.findOne({
        where: { email: u.email.toLowerCase() },
        withDeleted: true,
      });
      if (existing) {
        console.log(`  ↻ user ${u.email} already exists`);
        continue;
      }
      const row = userRepo.create({
        email: u.email.toLowerCase(),
        passwordHash,
        displayName: u.displayName,
        role: u.role,
        accessStatus: u.accessStatus,
      });
      await userRepo.save(row);
      console.log(`  ✓ user ${u.email} (role=${u.role})`);
    }

    let general = await categoryRepo.findOne({
      where: { slug: 'general' },
      withDeleted: true,
    });
    if (!general) {
      general = categoryRepo.create({
        slug: 'general',
        name: 'General',
        description:
          'Open-ended idea bucket — anything that does not fit elsewhere.',
        isActive: 'active' as never,
        sortOrder: 0,
        color: '#5b8def',
      });
      await categoryRepo.save(general);
      console.log('  ✓ category general');
    } else {
      console.log('  ↻ category general already exists');
    }

    const concept = await conceptRepo.findOne({
      where: { title: 'Sample concept' },
      withDeleted: true,
    });
    if (!concept) {
      const row = conceptRepo.create({
        categoryId: general.id,
        title: 'Sample concept',
        brief: 'A starter concept to validate the workflow end-to-end.',
        rewardBudget: '1000.00',
        status: 'active',
        metadata: { tags: ['starter'] },
        openDate: new Date(),
      });
      await conceptRepo.save(row);
      console.log('  ✓ concept "Sample concept" active');
    } else {
      console.log('  ↻ concept "Sample concept" already exists');
    }

    console.log('Seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
