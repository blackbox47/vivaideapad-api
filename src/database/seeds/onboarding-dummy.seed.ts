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
import {
  Application,
  ApplicationStatus,
} from '../../admin/applications/application.entity';

interface SeedApplication {
  title: string;
  description: string;
}

const DUMMY_CATEGORY_SLUG = 'onboarding-dummy';
const DUMMY_CATEGORY_NAME = 'Onboarding Testing';

const DUMMY_USER_EMAIL = 'dummy.onboarding@viva.local';
const DUMMY_USER_DISPLAY_NAME = 'Dummy Onboarding Tester';
const DUMMY_USER_PASSWORD = 'DummyOnboarding!2026';

const SEED_APPLICATIONS: SeedApplication[] = [
  {
    title: 'Async standups for distributed product teams',
    description:
      'Replace the 9am meeting with a written update covering what shipped yesterday, what is in flight, and what is blocked. Time zones stop being a tax and introverts get equal airtime.',
  },
  {
    title: 'A lightweight RFC process for small architectural changes',
    description:
      'A 2-page RFC template, a 48-hour comment window, and a single approver. Anything larger than 1 sprint of work needs an RFC. Smaller changes ship without ceremony.',
  },
  {
    title: 'Customer interview panel for the engineering org',
    description:
      'Spin up a vetted pool of 30 customers willing to do monthly 30-minute calls. Engineering rotates through the calendar so the whole org hears the voice of the customer, not just product managers.',
  },
  {
    title: 'A shared retro board across product, design, and engineering',
    description:
      'One retro every two weeks with sticky notes exported from each team and merged into a single board. Trends surface faster and cross-team fixes become a normal artifact.',
  },
  {
    title: 'Dark-mode-aware screenshot diffs in CI',
    description:
      'Extend the visual regression suite to capture both themes on every PR. Catches the subtle color-contrast bugs that only show up when users flip the toggle at runtime.',
  },
  {
    title: 'Onboarding journal for new hires — first 30 days',
    description:
      'New hires keep a daily journal entry for the first month covering wins, confusions, and unanswered questions. Patterns feed back into the onboarding doc.',
  },
  {
    title: 'A/B testing framework that does not require a platform team',
    description:
      'Self-service experiment creation for product engineers: pick a flag, define a metric, ship. No tickets to a separate experimentation team for the common cases.',
  },
  {
    title: 'Engineering blog series on production incidents',
    description:
      'Once a quarter, the on-call writes a sanitized postmortem for the engineering blog. Other engineers learn from real failure modes and the public commitment raises the quality of the postmortems.',
  },
  {
    title: 'Mentorship matching that rotates every quarter',
    description:
      'Pair mentees with a different mentor each quarter for a year. Spreads the load, broadens the network, and avoids the trap of one mentor becoming a single point of failure.',
  },
  {
    title: 'A weekly 15-minute product demo, no slides allowed',
    description:
      'Engineers demo something they shipped that week — live, in front of the rest of the org. Five minutes of demo, ten minutes of questions. Builds shared context faster than any all-hands.',
  },
  {
    title: 'Feature flag sunset policy: 90 days or remove',
    description:
      'Every feature flag must be either fully rolled out or removed within 90 days of creation. Prevents the long tail of dead flags that haunt codebases years later.',
  },
  {
    title: 'A "small wins" channel that pings the team daily',
    description:
      'A low-traffic channel where anyone can drop a small win from the day. Counters the doom-scroll of incident channels and gives the team a regular hit of momentum.',
  },
  {
    title: 'Cross-team office hours for shared libraries',
    description:
      'Owners of shared libraries hold open office hours twice a week. Consumers can drop in with questions instead of filing issues that sit in a queue.',
  },
  {
    title: 'Quarterly architecture decision records (ADRs) digest',
    description:
      'Every quarter, summarize the ADRs from the previous quarter into a 2-page digest for the whole engineering org. Keeps context alive without forcing everyone to read every ADR.',
  },
  {
    title: 'Internal API design review before implementation',
    description:
      'Before any new internal API ships, the author runs a 30-minute review with two senior engineers from outside the team. Cheap insurance against costly interface mistakes.',
  },
  {
    title: 'A "code I am proud of" demo day, once a month',
    description:
      'Engineers volunteer to demo a piece of code they are particularly proud of. Not for review — for celebration. Builds craft culture and surfaces patterns worth adopting elsewhere.',
  },
  {
    title: 'Runbooks as living docs, not wikis',
    description:
      'Runbooks live in the same repo as the service they document, with the same review process as code. Stale runbooks are caught by CI when the underlying service changes.',
  },
  {
    title: 'Customer support rotation for senior engineers',
    description:
      'Every senior engineer spends one week per quarter on the support rotation. Tickets, escalations, and a daily standup with the support lead. Senior engineers see the real product every quarter.',
  },
  {
    title: 'A weekly "office hours with the CTO" slot',
    description:
      'One hour a week, anyone can drop in and ask the CTO anything. No agenda, no slides. Surfaces concerns early and keeps the leadership in touch with the front line.',
  },
  {
    title: 'Hiring debrief template that scores consistently',
    description:
      'Standardize the debrief form across all interviews so the hiring committee can compare candidates on the same axes. Cuts cycle time and reduces bias from unstructured notes.',
  },
];

const APPLICATION_COUNT = SEED_APPLICATIONS.length;

function referenceNumber(index: number): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(index + 1).padStart(2, '0');
  return `APP-${datePart}-DUMY${seq}`;
}

async function ensureCategory(
  repo: import('typeorm').Repository<Category>,
): Promise<Category> {
  let cat = await repo.findOne({
    where: { slug: DUMMY_CATEGORY_SLUG },
    withDeleted: true,
  });
  if (!cat) {
    cat = repo.create({
      slug: DUMMY_CATEGORY_SLUG,
      name: DUMMY_CATEGORY_NAME,
      description: 'Category holding onboarding dummy applications.',
      isActive: 'active' as never,
      sortOrder: 200,
      color: '#0ea5e9',
    });
    await repo.save(cat);
    console.log(`  ✓ category ${DUMMY_CATEGORY_SLUG}`);
  } else {
    if (cat.deletedAt) cat.deletedAt = null;
    cat.isActive = 'active';
    cat.name = DUMMY_CATEGORY_NAME;
    cat.description = 'Category holding onboarding dummy applications.';
    cat.sortOrder = 200;
    cat.color = '#0ea5e9';
    await repo.save(cat);
    console.log(`  ↻ category ${DUMMY_CATEGORY_SLUG} ready`);
  }
  return cat;
}

async function ensureDummyUser(
  repo: import('typeorm').Repository<User>,
  password: string,
): Promise<User> {
  const email = DUMMY_USER_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await repo.findOne({
    where: { email },
    withDeleted: true,
  });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.displayName = DUMMY_USER_DISPLAY_NAME;
    existing.role = USER_ROLES.CONTRIBUTOR;
    existing.accessStatus = 'pending_review' satisfies AccessStatus;
    if (existing.deletedAt) existing.deletedAt = null;
    await repo.save(existing);
    console.log(`  ↻ user ${email} refreshed`);
    return existing;
  }
  const row = repo.create({
    email,
    passwordHash,
    displayName: DUMMY_USER_DISPLAY_NAME,
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'pending_review' satisfies AccessStatus,
  });
  await repo.save(row);
  console.log(`  ✓ user ${email} created`);
  return row;
}

async function ensureApplications(
  repo: import('typeorm').Repository<Application>,
  user: User,
  category: Category,
): Promise<{ created: number; referenceNumbers: string[] }> {
  const referenceNumbers: string[] = [];
  let created = 0;
  for (let i = 0; i < APPLICATION_COUNT; i += 1) {
    const seed = SEED_APPLICATIONS[i];
    const ref = referenceNumber(i);
    const existing = await repo.findOne({
      where: {
        userId: user.id,
        ideaTitle: seed.title,
      },
      withDeleted: true,
    });
    if (existing) {
      if (existing.deletedAt) existing.deletedAt = null;
      existing.ideaDescription = seed.description;
      existing.categoryId = category.id;
      existing.referenceNumber = ref;
      existing.consent = 1;
      await repo.save(existing);
      console.log(`  ↻ application "${seed.title}" already exists`);
      referenceNumbers.push(ref);
      continue;
    }
    const row = repo.create({
      userId: user.id,
      categoryId: category.id,
      ideaTitle: seed.title,
      ideaDescription: seed.description,
      attachments: null,
      status: 'submitted' satisfies ApplicationStatus,
      decisionNotes: null,
      decidedAt: null,
      decidedBy: null,
      referenceNumber: ref,
      consent: 1,
    });
    await repo.save(row);
    referenceNumbers.push(ref);
    created += 1;
    console.log(`  ✓ application "${seed.title}" (${ref})`);
  }
  return { created, referenceNumbers };
}

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const userRepo = AppDataSource.getRepository(User);
    const categoryRepo = AppDataSource.getRepository(Category);
    const applicationRepo = AppDataSource.getRepository(Application);

    const category = await ensureCategory(categoryRepo);
    const dummyUser = await ensureDummyUser(userRepo, DUMMY_USER_PASSWORD);
    const { created, referenceNumbers } = await ensureApplications(
      applicationRepo,
      dummyUser,
      category,
    );

    console.log('---');
    console.log(`Dummy user id:      ${dummyUser.id}`);
    console.log(`Dummy user email:   ${dummyUser.email}`);
    console.log(`Dummy user password: ${DUMMY_USER_PASSWORD}`);
    console.log(`Category id:        ${category.id} (slug=${category.slug})`);
    console.log(`Applications created: ${created}`);
    console.log(`Applications total:   ${referenceNumbers.length}`);
    console.log('Reference numbers:');
    for (const ref of referenceNumbers) {
      console.log(`  - ${ref}`);
    }
    console.log('Seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Onboarding dummy seed failed:', err);
  process.exit(1);
});
