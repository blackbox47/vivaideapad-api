import 'reflect-metadata';
import * as bcrypt from 'bcrypt';

import { AppDataSource } from '../data-source';
import {
  AccessStatus,
  User,
  UserRole,
  USER_ROLES,
} from '../../users/entities/user.entity';
import { Category } from '../../admin/categories/category.entity';
import { Concept } from '../../admin/concepts/concept.entity';
import { Submission } from '../../contributor/entities/submission.entity';

interface SeedContributor {
  email: string;
  displayName: string;
  bio: string;
  role: UserRole;
  accessStatus: AccessStatus;
  password: string;
  submissions: SeedSubmission[];
}

interface SeedSubmission {
  title: string;
  body: string;
  conceptSlug: string;
  status:
    'draft' | 'pending_review' | 'changes_requested' | 'approved' | 'rejected';
  attachments?: Record<string, unknown> | null;
}

const DEFAULT_CATEGORY_SLUG = 'e2e-category';
const DEFAULT_CATEGORY_NAME = 'E2E Testing';

// Concepts the seeded contributors submit against. The seed will create
// them under the e2e category if they don't already exist.
const SEED_CONCEPTS: Array<{
  slug: string;
  title: string;
  brief: string;
  rewardBudget: string;
  isOnboarding: boolean;
  status: 'draft' | 'active' | 'archived';
}> = [
  {
    slug: 'e2e-product-feedback',
    title: 'Product feedback loops',
    brief:
      'Share concrete feedback loops you have used to ship better products faster.',
    rewardBudget: '1500.00',
    isOnboarding: true,
    status: 'active',
  },
  {
    slug: 'e2e-distributed-systems',
    title: 'Distributed systems patterns',
    brief:
      'Patterns you have applied when building resilient distributed systems.',
    rewardBudget: '2500.00',
    isOnboarding: false,
    status: 'active',
  },
  {
    slug: 'e2e-onboarding-paths',
    title: 'Onboarding paths for new contributors',
    brief: 'How do you onboard new contributors into a community of practice?',
    rewardBudget: '1000.00',
    isOnboarding: true,
    status: 'active',
  },
];

const SEED_CONTRIBUTORS: SeedContributor[] = [
  {
    email: 'alice.e2e@viva.local',
    displayName: 'Alice Rahman',
    bio: 'Senior product engineer working on feedback loops.',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    password: 'AliceE2E!2026',
    submissions: [
      {
        title: 'Closing the loop with weekly customer interviews',
        body: 'Weekly 30-minute interviews with churned customers revealed three recurring friction points: pricing confusion, missing mobile parity, and unclear upgrade paths. After acting on the top one each week for a quarter, NPS lifted 12 points.',
        conceptSlug: 'e2e-product-feedback',
        status: 'pending_review',
      },
      {
        title: 'In-product micro-surveys after key moments',
        body: 'Trigger a two-question micro-survey immediately after aha moments and after friction moments. We saw a 40% response rate vs 6% on email surveys.',
        conceptSlug: 'e2e-product-feedback',
        status: 'draft',
      },
    ],
  },
  {
    email: 'bob.e2e@viva.local',
    displayName: 'Bob Hossain',
    bio: 'Backend engineer focused on resilient services.',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    password: 'BobE2E!2026',
    submissions: [
      {
        title: 'Outbox pattern for cross-service consistency',
        body: 'Rather than dual-writing to a database and a queue in the request path, persist the event in an outbox table inside the same transaction and let a relay process publish it. We eliminated lost events during deploys.',
        conceptSlug: 'e2e-distributed-systems',
        status: 'pending_review',
        attachments: { url: 'https://example.com/diagrams/outbox.png' },
      },
      {
        title: 'Idempotency keys on every mutating endpoint',
        body: 'Require clients to send a UUID idempotency key on POST/PUT/PATCH. Cache the response by key for 24h so retries never double-charge.',
        conceptSlug: 'e2e-distributed-systems',
        status: 'approved',
      },
    ],
  },
  {
    email: 'carla.e2e@viva.local',
    displayName: 'Carla Karim',
    bio: 'Community lead experimenting with contributor onboarding.',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    password: 'CarlaE2E!2026',
    submissions: [
      {
        title: 'A 14-day onboarding sprint for new contributors',
        body: 'Day 1 environment setup, Day 5 first merged PR, Day 10 pairing session, Day 14 retrospective. Drop-off dropped from 60% to 18%.',
        conceptSlug: 'e2e-onboarding-paths',
        status: 'changes_requested',
      },
    ],
  },
  {
    email: 'dan.e2e@viva.local',
    displayName: 'Dan Siddiqui',
    bio: 'Independent contributor.',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    password: 'DanE2E!2026',
    submissions: [
      {
        title: 'A buddy system that scales',
        body: 'Pair every new contributor with a buddy for their first month. Buddies are picked from a rotating pool so no one gets burned out.',
        conceptSlug: 'e2e-onboarding-paths',
        status: 'pending_review',
      },
    ],
  },
  {
    email: 'eva.e2e@viva.local',
    displayName: 'Eva Akter',
    bio: 'QA engineer with a soft spot for chaos testing.',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'pending_review',
    password: 'EvaE2E!2026',
    submissions: [],
  },
];

async function ensureCategory(
  repo: import('typeorm').Repository<Category>,
): Promise<Category> {
  let cat = await repo.findOne({
    where: { slug: DEFAULT_CATEGORY_SLUG },
    withDeleted: true,
  });
  if (!cat) {
    cat = repo.create({
      slug: DEFAULT_CATEGORY_SLUG,
      name: DEFAULT_CATEGORY_NAME,
      description: 'Category holding E2E seed concepts.',
      isActive: 'active' as never,
      sortOrder: 100,
      color: '#22c55e',
    });
    await repo.save(cat);
    console.log(`  ✓ category ${DEFAULT_CATEGORY_SLUG}`);
  } else {
    if (cat.deletedAt) {
      cat.deletedAt = null;
    }
    cat.isActive = 'active';
    await repo.save(cat);
    console.log(`  ↻ category ${DEFAULT_CATEGORY_SLUG} ready`);
  }
  return cat;
}

async function ensureConcepts(
  repo: import('typeorm').Repository<Concept>,
  categoryId: string,
): Promise<Map<string, Concept>> {
  const out = new Map<string, Concept>();
  for (const c of SEED_CONCEPTS) {
    let row = await repo.findOne({
      where: { title: c.title },
      withDeleted: true,
    });
    if (!row) {
      row = repo.create({
        categoryId,
        title: c.title,
        brief: c.brief,
        rewardBudget: c.rewardBudget,
        isOnboarding: c.isOnboarding,
        status: c.status,
        metadata: { slug: c.slug, e2e: true },
        openDate: c.status === 'active' ? new Date() : null,
      });
      await repo.save(row);
      console.log(`  ✓ concept "${c.title}" (${c.status})`);
    } else {
      row.categoryId = categoryId;
      row.brief = c.brief;
      row.rewardBudget = c.rewardBudget;
      row.isOnboarding = c.isOnboarding;
      row.status = c.status;
      row.metadata = { ...(row.metadata || {}), slug: c.slug, e2e: true };
      if (c.status === 'active' && !row.openDate) row.openDate = new Date();
      if (row.deletedAt) row.deletedAt = null;
      await repo.save(row);
      console.log(`  ↻ concept "${c.title}" refreshed`);
    }
    out.set(c.slug, row);
  }
  return out;
}

async function ensureContributor(
  repo: import('typeorm').Repository<User>,
  c: SeedContributor,
): Promise<User> {
  const existing = await repo.findOne({
    where: { email: c.email.toLowerCase() },
    withDeleted: true,
  });
  const passwordHash = await bcrypt.hash(c.password, 10);
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.displayName = c.displayName;
    existing.bio = c.bio;
    existing.role = c.role;
    existing.accessStatus = c.accessStatus;
    existing.deletedAt = null;
    await repo.save(existing);
    console.log(`  ↻ contributor ${c.email} refreshed`);
    return existing;
  }
  const row = repo.create({
    email: c.email.toLowerCase(),
    passwordHash,
    displayName: c.displayName,
    bio: c.bio,
    role: c.role,
    accessStatus: c.accessStatus,
  });
  await repo.save(row);
  console.log(`  ✓ contributor ${c.email} created`);
  return row;
}

async function ensureSubmissions(
  repo: import('typeorm').Repository<Submission>,
  user: User,
  conceptBySlug: Map<string, Concept>,
  subs: SeedSubmission[],
): Promise<number> {
  let created = 0;
  for (const s of subs) {
    const concept = conceptBySlug.get(s.conceptSlug);
    if (!concept) {
      console.warn(
        `  ! skipping submission "${s.title}" — concept slug ${s.conceptSlug} missing`,
      );
      continue;
    }
    const existing = await repo.findOne({
      where: {
        userId: user.id,
        title: s.title,
      },
      withDeleted: true,
    });
    if (existing) {
      console.log(`  ↻ submission "${s.title}" already exists`);
      continue;
    }
    const row = repo.create({
      userId: user.id,
      conceptId: concept.id,
      title: s.title,
      body: s.body,
      attachments: s.attachments ?? null,
      status: s.status,
      decidedAt:
        s.status === 'approved' || s.status === 'rejected' ? new Date() : null,
      decisionNotes:
        s.status === 'rejected'
          ? 'Seeded for E2E — please review with a real admin.'
          : null,
    });
    await repo.save(row);
    created += 1;
    console.log(`  ✓ submission "${s.title}" (${s.status})`);
  }
  return created;
}

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const userRepo = AppDataSource.getRepository(User);
    const categoryRepo = AppDataSource.getRepository(Category);
    const conceptRepo = AppDataSource.getRepository(Concept);
    const submissionRepo = AppDataSource.getRepository(Submission);

    const category = await ensureCategory(categoryRepo);
    const conceptBySlug = await ensureConcepts(conceptRepo, category.id);

    let totalUsers = 0;
    let totalSubmissions = 0;
    for (const c of SEED_CONTRIBUTORS) {
      const user = await ensureContributor(userRepo, c);
      totalUsers += 1;
      totalSubmissions += await ensureSubmissions(
        submissionRepo,
        user,
        conceptBySlug,
        c.submissions,
      );
    }

    console.log('---');
    console.log(`Contributors seeded: ${totalUsers}`);
    console.log(`Submissions created: ${totalSubmissions}`);
    console.log('Seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Contributor seed failed:', err);
  process.exit(1);
});
