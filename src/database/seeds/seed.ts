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
import { Application } from '../../admin/applications/application.entity';
import { Submission } from '../../contributor/entities/submission.entity';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { PayoutRequest } from '../../admin/payouts/payout.entity';
import { LeaderboardRecord } from '../../admin/leaderboard/leaderboard-record.entity';
import { Notification } from '../../admin/notifications/notification.entity';
import { AuditEvent } from '../../admin/audit-events/audit-event.entity';
import { PaymentMethod } from '../../admin/payment-methods/payment-method.entity';

const DEFAULT_PASSWORD = 'ChangeMe!123';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

interface SeedUser {
  key: string;
  email: string;
  displayName: string;
  role: UserRole;
  accessStatus: AccessStatus;
  bio?: string;
  payoutAccount?: string;
}

/** All demo personas are male. */
const SEED_USERS: SeedUser[] = [
  {
    key: 'admin',
    email: 'admin@viva.local',
    displayName: 'Viva Admin',
    role: USER_ROLES.ADMINISTRATOR,
    accessStatus: 'active',
  },
  {
    key: 'super',
    email: 'super@viva.local',
    displayName: 'Viva Superadmin',
    role: USER_ROLES.SUPERADMIN,
    accessStatus: 'active',
  },
  {
    key: 'imran',
    email: 'imran.hossain@viva.com.bd',
    displayName: 'Imran Hossain',
    role: USER_ROLES.ADMINISTRATOR,
    accessStatus: 'active',
    bio: 'Ops admin for IdeaPad content and payouts.',
  },
  {
    key: 'contrib1',
    email: 'contrib1@viva.local',
    displayName: 'Aminul Haque',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    payoutAccount: '01711000001',
  },
  {
    key: 'contrib2',
    email: 'contrib2@viva.local',
    displayName: 'Bashir Ahmed',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    payoutAccount: '01711000002',
  },
  {
    key: 'arif',
    email: 'arif.chowdhury@example.com',
    displayName: 'Arif Chowdhury',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    bio: 'Campus creator from DU.',
    payoutAccount: '01712000011',
  },
  {
    key: 'rafiqul',
    email: 'rafiqul.islam@example.com',
    displayName: 'Rafiqul Islam',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    payoutAccount: '01712000012',
  },
  {
    key: 'karim',
    email: 'karim.uddin@example.com',
    displayName: 'Karim Uddin',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    payoutAccount: '01712000013',
  },
  {
    key: 'tanvir',
    email: 'tanvir.hassan@example.com',
    displayName: 'Tanvir Hassan',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    payoutAccount: '01712000014',
  },
  {
    key: 'mehedi',
    email: 'mehedi.hasan@example.com',
    displayName: 'Mehedi Hasan',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'pending_review',
  },
  {
    key: 'jahidul',
    email: 'jahidul.islam@example.com',
    displayName: 'Jahidul Islam',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'suspended',
  },
  {
    key: 'saiful',
    email: 'saiful.alam@example.com',
    displayName: 'Saiful Alam',
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'invited',
  },
];

const CATEGORIES = [
  {
    slug: 'general',
    name: 'General',
    description: 'Open-ended idea bucket — anything that does not fit elsewhere.',
    color: '#5b8def',
    sortOrder: 0,
    isActive: 'active' as const,
  },
  {
    slug: 'digital-services',
    name: 'Digital Services',
    description: 'Apps, packs, and digital product experiences.',
    color: '#0EA5A4',
    sortOrder: 1,
    isActive: 'active' as const,
  },
  {
    slug: 'customer-experience',
    name: 'Customer Experience',
    description: 'Service moments that reduce friction and confusion.',
    color: '#F59E0B',
    sortOrder: 2,
    isActive: 'active' as const,
  },
  {
    slug: 'youth-engagement',
    name: 'Youth & Campus',
    description: 'Ideas that resonate with students and young creators.',
    color: '#6366F1',
    sortOrder: 3,
    isActive: 'active' as const,
  },
  {
    slug: 'financial-inclusion',
    name: 'Financial Inclusion',
    description: 'Small merchants, wallets, and everyday money tools.',
    color: '#10B981',
    sortOrder: 4,
    isActive: 'active' as const,
  },
  {
    slug: 'network-coverage',
    name: 'Network & Coverage',
    description: 'Signal quality, corridors, and coverage feedback.',
    color: '#8B5CF6',
    sortOrder: 5,
    isActive: 'archived' as const,
  },
];

async function ensureUser(
  repo: ReturnType<typeof AppDataSource.getRepository<User>>,
  passwordHash: string,
  u: SeedUser,
): Promise<User> {
  const email = u.email.toLowerCase();
  let row = await repo.findOne({ where: { email }, withDeleted: true });
  if (row) {
    row.displayName = u.displayName;
    row.role = u.role;
    row.accessStatus = u.accessStatus;
    row.bio = u.bio ?? row.bio;
    if (u.payoutAccount) {
      row.displayPrefs = {
        ...(row.displayPrefs ?? {}),
        payout_method: {
          type: 'bkash',
          account: u.payoutAccount,
          label: `bKash · ${u.payoutAccount}`,
        },
      };
    }
    if (row.deletedAt) row.deletedAt = null;
    await repo.save(row);
    console.log(`  ↻ user ${email}`);
    return row;
  }

  row = repo.create({
    email,
    passwordHash,
    displayName: u.displayName,
    role: u.role,
    accessStatus: u.accessStatus,
    bio: u.bio ?? null,
    displayPrefs: u.payoutAccount
      ? {
          payout_method: {
            type: 'bkash',
            account: u.payoutAccount,
            label: `bKash · ${u.payoutAccount}`,
          },
        }
      : null,
  });
  await repo.save(row);
  console.log(`  ✓ user ${email} (role=${u.role})`);
  return row;
}

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const userRepo = AppDataSource.getRepository(User);
    const categoryRepo = AppDataSource.getRepository(Category);
    const conceptRepo = AppDataSource.getRepository(Concept);
    const applicationRepo = AppDataSource.getRepository(Application);
    const submissionRepo = AppDataSource.getRepository(Submission);
    const ledgerRepo = AppDataSource.getRepository(LedgerEntry);
    const payoutRepo = AppDataSource.getRepository(PayoutRequest);
    const leaderboardRepo = AppDataSource.getRepository(LeaderboardRecord);
    const notificationRepo = AppDataSource.getRepository(Notification);
    const auditRepo = AppDataSource.getRepository(AuditEvent);
    const paymentMethodRepo = AppDataSource.getRepository(PaymentMethod);

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const users = new Map<string, User>();

    console.log('Users');
    for (const u of SEED_USERS) {
      users.set(u.key, await ensureUser(userRepo, passwordHash, u));
    }

    const admin = users.get('admin')!;
    const imran = users.get('imran')!;
    const arif = users.get('arif')!;
    const rafiqul = users.get('rafiqul')!;
    const karim = users.get('karim')!;
    const tanvir = users.get('tanvir')!;
    const mehedi = users.get('mehedi')!;
    const jahidul = users.get('jahidul')!;
    const contrib1 = users.get('contrib1')!;
    const contrib2 = users.get('contrib2')!;
    const saiful = users.get('saiful')!;

    console.log('Payment methods');
    let bkash = await paymentMethodRepo.findOne({
      where: { code: 'bKash' },
      withDeleted: true,
    });
    if (!bkash) {
      bkash = paymentMethodRepo.create({
        code: 'bKash',
        name: 'bKash',
        description: 'Mobile wallet payouts in Bangladesh.',
        isActive: true,
        sortOrder: 0,
        accountHint: '01XXXXXXXXX',
      });
      await paymentMethodRepo.save(bkash);
      console.log('  ✓ payment method bKash');
    } else {
      console.log('  ↻ payment method bKash');
    }

    console.log('Categories');
    const categories = new Map<string, Category>();
    for (const c of CATEGORIES) {
      let row = await categoryRepo.findOne({
        where: { slug: c.slug },
      withDeleted: true,
    });
      if (!row) {
        row = categoryRepo.create({
          slug: c.slug,
          name: c.name,
          description: c.description,
          color: c.color,
          sortOrder: c.sortOrder,
          isActive: c.isActive,
        });
        await categoryRepo.save(row);
        console.log(`  ✓ category ${c.slug}`);
      } else {
        row.name = c.name;
        row.description = c.description;
        row.color = c.color;
        row.sortOrder = c.sortOrder;
        row.isActive = c.isActive;
        row.deletedAt = null;
        await categoryRepo.save(row);
        console.log(`  ↻ category ${c.slug}`);
      }
      categories.set(c.slug, row);
    }

    console.log('Concepts');
    const conceptDefs = [
      {
        key: 'sample',
        title: 'Sample concept',
        category: 'general',
        brief: 'A starter concept to validate the workflow end-to-end.',
        rewardBudget: '1000.00',
        status: 'active' as const,
        isOnboarding: false,
        openDate: daysAgo(30),
        closeDate: daysFromNow(60),
        metadata: { tags: ['starter'] },
      },
      {
        key: 'recharge',
        title: 'Recharge reminder that feels personal',
        category: 'digital-services',
        brief:
          'Design a recharge nudge that feels helpful — not spammy — for prepaid users.',
        rewardBudget: '25000.00',
        status: 'active' as const,
        isOnboarding: false,
        openDate: daysAgo(14),
        closeDate: daysFromNow(45),
        metadata: { tags: ['recharge', 'push'] },
      },
      {
        key: 'balance',
        title: 'Fix the “why is my balance low?” moment',
        category: 'customer-experience',
        brief:
          'Help customers understand sudden balance drops without calling the hotline.',
        rewardBudget: '15000.00',
        status: 'active' as const,
        isOnboarding: false,
        openDate: daysAgo(10),
        closeDate: daysFromNow(40),
        metadata: { tags: ['cx', 'balance'] },
      },
      {
        key: 'campus',
        title: 'Campus ambassador activation kit',
        category: 'youth-engagement',
        brief:
          'A ready-to-run kit for campus ambassadors hosting IdeaPad booths.',
        rewardBudget: '20000.00',
        status: 'active' as const,
        isOnboarding: true,
        openDate: daysAgo(7),
        closeDate: daysFromNow(50),
        metadata: { tags: ['campus', 'onboarding'] },
      },
      {
        key: 'merchant',
        title: 'bKash-friendly small merchant tips',
        category: 'financial-inclusion',
        brief:
          'Practical tips for tea stalls and fuchka carts using mobile wallets.',
        rewardBudget: '30000.00',
        status: 'active' as const,
        isOnboarding: false,
        openDate: daysAgo(5),
        closeDate: daysFromNow(35),
        metadata: { tags: ['merchant', 'bkash'] },
      },
      {
        key: 'coverage',
        title: 'Spotty 4G corridor report from riders',
        category: 'network-coverage',
        brief:
          'Collect corridor-level coverage notes from motorbike couriers and riders.',
        rewardBudget: '18000.00',
        status: 'active' as const,
        isOnboarding: false,
        openDate: daysAgo(20),
        closeDate: daysFromNow(20),
        metadata: { tags: ['network'] },
      },
      {
        key: 'storyboard',
        title: 'IdeaPad onboarding storyboard',
        category: 'general',
        brief: 'Draft a welcome storyboard for first-time contributors.',
        rewardBudget: '5000.00',
        status: 'draft' as const,
        isOnboarding: false,
        openDate: null,
        closeDate: null,
        metadata: { tags: ['draft'] },
      },
      {
        key: 'eid',
        title: 'Eid campaign meme that doesn’t feel corporate',
        category: 'youth-engagement',
        brief: 'Closed concept from last month’s Eid campaign.',
        rewardBudget: '12000.00',
        status: 'archived' as const,
        isOnboarding: false,
        openDate: daysAgo(60),
        closeDate: daysAgo(20),
        metadata: { tags: ['campaign'] },
      },
      {
        key: 'voice',
        title: 'Voice-bundle discovery for new SIMs',
        category: 'digital-services',
        brief: 'Help new SIM users discover the right voice pack on day one.',
        rewardBudget: '22000.00',
        status: 'active' as const,
        isOnboarding: false,
        openDate: daysAgo(3),
        closeDate: daysFromNow(30),
        metadata: { tags: ['voice', 'sim'] },
      },
    ];

    const concepts = new Map<string, Concept>();
    for (const def of conceptDefs) {
      const category = categories.get(def.category)!;
      let row = await conceptRepo.findOne({
        where: { title: def.title },
        withDeleted: true,
      });
      if (!row) {
        row = conceptRepo.create({
          categoryId: category.id,
          title: def.title,
          brief: def.brief,
          rewardBudget: def.rewardBudget,
          status: def.status,
          isOnboarding: def.isOnboarding,
          openDate: def.openDate,
          closeDate: def.closeDate,
          metadata: def.metadata,
        });
        await conceptRepo.save(row);
        console.log(`  ✓ concept "${def.title}"`);
      } else {
        row.categoryId = category.id;
        row.brief = def.brief;
        row.rewardBudget = def.rewardBudget;
        row.status = def.status;
        row.isOnboarding = def.isOnboarding;
        row.openDate = def.openDate;
        row.closeDate = def.closeDate;
        row.metadata = def.metadata;
        row.deletedAt = null;
      await conceptRepo.save(row);
        console.log(`  ↻ concept "${def.title}"`);
      }
      concepts.set(def.key, row);
    }

    console.log('Applications');
    const applicationDefs = [
      {
        ref: 'APP-20260310-MH01',
        user: mehedi,
        category: 'digital-services',
        title: 'Smart data rollover alert',
        description:
          'Notify users before unused data expires, with a one-tap rollover option.',
        status: 'submitted' as const,
        decidedBy: null as User | null,
        notes: null as string | null,
      },
      {
        ref: 'APP-20260308-JI02',
        user: jahidul,
        category: 'customer-experience',
        title: 'Agent script for roaming panic',
        description:
          'A short script agents can use when customers panic about roaming charges.',
        status: 'needs_info' as const,
        decidedBy: imran,
        notes: 'Please add a Bangla version of the script.',
      },
      {
        ref: 'APP-20260301-AC03',
        user: arif,
        category: 'youth-engagement',
        title: 'University IdeaPad clubs',
        description:
          'Student clubs that run monthly idea sprints with campus prizes.',
        status: 'approved_invited' as const,
        decidedBy: admin,
        notes: 'Strong fit — invite sent.',
      },
      {
        ref: 'APP-20260228-TH04',
        user: tanvir,
        category: 'financial-inclusion',
        title: 'Micro-merchant QR tips card',
        description: 'Pocket card explaining QR acceptance for street vendors.',
        status: 'rejected' as const,
        decidedBy: imran,
        notes: 'Overlaps an existing concept.',
      },
      {
        ref: 'APP-20260309-RI05',
        user: rafiqul,
        category: 'network-coverage',
        title: 'Crowd-sourced dead-zone map',
        description:
          'Riders pin weak-signal spots; ops gets a weekly heatmap digest.',
        status: 'submitted' as const,
        decidedBy: null,
        notes: null,
      },
      {
        ref: 'APP-20260220-KU06',
        user: karim,
        category: 'general',
        title: 'Family plan fairness calculator',
        description: 'Show each member how shared data is used fairly.',
        status: 'withdrawn' as const,
        decidedBy: null,
        notes: null,
      },
      {
        ref: 'APP-20260310-SA07',
        user: saiful,
        category: 'digital-services',
        title: 'App home that explains packs',
        description: 'A clearer home screen that demystifies pack names.',
        status: 'submitted' as const,
        decidedBy: null,
        notes: null,
      },
      {
        ref: 'APP-20260305-BA08',
        user: contrib2,
        category: 'youth-engagement',
        title: 'Campus reel challenge for IdeaPad',
        description: 'Short-form video challenge to promote IdeaPad on campus.',
        status: 'approved_invited' as const,
        decidedBy: admin,
        notes: 'Approved for contributor access.',
      },
    ];

    for (const def of applicationDefs) {
      let row = await applicationRepo.findOne({
        where: { referenceNumber: def.ref },
        withDeleted: true,
      });
      const category = categories.get(def.category)!;
      if (!row) {
        row = applicationRepo.create({
          userId: def.user.id,
          categoryId: category.id,
          ideaTitle: def.title,
          ideaDescription: def.description,
          status: def.status,
          referenceNumber: def.ref,
          consent: 1,
          decidedBy: def.decidedBy?.id ?? null,
          decidedAt: def.decidedBy ? daysAgo(2) : null,
          decisionNotes: def.notes,
        });
        await applicationRepo.save(row);
        console.log(`  ✓ application ${def.ref}`);
      } else {
        console.log(`  ↻ application ${def.ref}`);
      }
    }

    console.log('Submissions');
    const submissionDefs = [
      {
        key: 'arif-recharge',
        user: arif,
        concept: 'recharge',
        title: '“Bhaiya, balance lagbe?” push copy',
        body: 'A friendly Banglish push that reminds users to recharge before a call drops.',
        status: 'approved' as const,
        rewardAmount: '5000.00',
        decidedBy: imran,
        decisionNotes: 'Clear voice and on-brand.',
      },
      {
        key: 'rafiqul-recharge',
        user: rafiqul,
        concept: 'recharge',
        title: 'Festival top-up streak',
        body: 'Streak rewards for topping up during Eid week without spamming the inbox.',
        status: 'pending_review' as const,
        rewardAmount: null,
        decidedBy: null,
        decisionNotes: null,
      },
      {
        key: 'karim-balance',
        user: karim,
        concept: 'balance',
        title: 'Balance story with emoji line',
        body: 'In-app story explaining the last three balance deductions in plain language.',
        status: 'changes_requested' as const,
        rewardAmount: null,
        decidedBy: imran,
        decisionNotes: 'Tighten the copy; remove jargon.',
      },
      {
        key: 'tanvir-campus',
        user: tanvir,
        concept: 'campus',
        title: 'Hall-war IdeaPad booth kit',
        body: 'Materials checklist, pitch script, and prize table layout for hall battles.',
        status: 'approved' as const,
        rewardAmount: '8000.00',
        decidedBy: admin,
        decisionNotes: 'Strong activation plan.',
      },
      {
        key: 'contrib1-sample',
        user: contrib1,
        concept: 'sample',
        title: 'First IdeaPad pitch',
        body: 'A short starter pitch validating the sample concept workflow.',
        status: 'approved' as const,
        rewardAmount: '1000.00',
        decidedBy: admin,
        decisionNotes: 'Looks good for demo.',
      },
      {
        key: 'contrib2-merchant',
        user: contrib2,
        concept: 'merchant',
        title: 'Tea-stall QR checklist',
        body: 'Five-step checklist printed on laminated card for tea stalls.',
        status: 'pending_review' as const,
        rewardAmount: null,
        decidedBy: null,
        decisionNotes: null,
      },
      {
        key: 'mehedi-coverage',
        user: mehedi,
        concept: 'coverage',
        title: 'Motorbike courier coverage notes',
        body: 'Weekly notes from couriers on Mirpur–Gulshan corridor dead spots.',
        status: 'rejected' as const,
        rewardAmount: null,
        decidedBy: imran,
        decisionNotes: 'Needs clearer sampling method.',
      },
      {
        key: 'arif-voice',
        user: arif,
        concept: 'voice',
        title: 'New SIM day-1 voice guide',
        body: 'Draft SMS sequence that helps a new SIM pick a starter voice pack.',
        status: 'draft' as const,
        rewardAmount: null,
        decidedBy: null,
        decisionNotes: null,
      },
      {
        key: 'tanvir-storyboard',
        user: tanvir,
        concept: 'storyboard',
        title: 'Welcome carousel in Banglish',
        body: 'Three-frame onboarding carousel mixing Bangla and English casually.',
        status: 'pending_review' as const,
        rewardAmount: null,
        decidedBy: null,
        decisionNotes: null,
      },
      {
        key: 'karim-campus',
        user: karim,
        concept: 'campus',
        title: 'Dorm meetup activation card',
        body: 'A meetup card for dorm floors hosting IdeaPad intro sessions.',
        status: 'approved' as const,
        rewardAmount: '4500.00',
        decidedBy: imran,
        decisionNotes: 'Approved with minor edits.',
      },
      {
        key: 'rafiqul-balance',
        user: rafiqul,
        concept: 'balance',
        title: 'IVR path that doesn’t hang',
        body: 'Draft IVR flow that explains balance dips without dumping callers.',
        status: 'draft' as const,
        rewardAmount: null,
        decidedBy: null,
        decisionNotes: null,
      },
      {
        key: 'contrib1-merchant',
        user: contrib1,
        concept: 'merchant',
        title: 'bKash float tips for fuchka stalls',
        body: 'How fuchka sellers keep enough float for lunch rush.',
        status: 'pending_review' as const,
        rewardAmount: null,
        decidedBy: null,
        decisionNotes: null,
      },
    ];

    const submissions = new Map<string, Submission>();
    for (const def of submissionDefs) {
      const concept = concepts.get(def.concept)!;
      let row = await submissionRepo.findOne({
        where: { title: def.title, userId: def.user.id },
        withDeleted: true,
      });
      if (!row) {
        row = submissionRepo.create({
          userId: def.user.id,
          conceptId: concept.id,
          title: def.title,
          body: def.body,
          status: def.status,
          rewardAmount: def.rewardAmount,
          decidedBy: def.decidedBy?.id ?? null,
          decidedAt: def.decidedBy ? daysAgo(1) : null,
          decisionNotes: def.decisionNotes,
          riskSignal:
            def.status === 'pending_review'
              ? { level: 'low', note: 'demo seed' }
              : null,
        });
        await submissionRepo.save(row);
        console.log(`  ✓ submission "${def.title}"`);
      } else {
        console.log(`  ↻ submission "${def.title}"`);
      }
      submissions.set(def.key, row);
    }

    console.log('Payouts + ledger');
    const payoutDefs = [
      {
        key: 'arif-pending',
        user: arif,
        amount: '2000.00',
        status: 'pending' as const,
        mobile: '01712000011',
        processedBy: null as User | null,
        reference: null as string | null,
        notes: null as string | null,
        holdStatus: 'pending' as const,
      },
      {
        key: 'tanvir-paid',
        user: tanvir,
        amount: '5000.00',
        status: 'paid' as const,
        mobile: '01712000014',
        processedBy: imran,
        reference: 'BK-TRX-88421',
        notes: 'Paid via bKash.',
        holdStatus: 'posted' as const,
      },
      {
        key: 'karim-rejected',
        user: karim,
        amount: '1500.00',
        status: 'rejected' as const,
        mobile: '01712000013',
        processedBy: imran,
        reference: null,
        notes: 'Account name mismatch.',
        holdStatus: 'reversed' as const,
      },
      {
        key: 'contrib1-pending',
        user: contrib1,
        amount: '800.00',
        status: 'pending' as const,
        mobile: '01711000001',
        processedBy: null,
        reference: null,
        notes: null,
        holdStatus: 'pending' as const,
      },
      {
        key: 'rafiqul-paid',
        user: rafiqul,
        amount: '3000.00',
        status: 'paid' as const,
        mobile: '01712000012',
        processedBy: admin,
        reference: 'BK-TRX-77109',
        notes: 'Paid.',
        holdStatus: 'posted' as const,
      },
      {
        key: 'contrib2-pending',
        user: contrib2,
        amount: '1200.00',
        status: 'pending' as const,
        mobile: '01711000002',
        processedBy: null,
        reference: null,
        notes: null,
        holdStatus: 'pending' as const,
      },
    ];

    const payouts = new Map<string, PayoutRequest>();
    for (const def of payoutDefs) {
      let row = await payoutRepo.findOne({
        where: {
          userId: def.user.id,
          amount: def.amount,
          status: def.status,
        },
        withDeleted: true,
      });
      if (!row) {
        row = payoutRepo.create({
          userId: def.user.id,
          amount: def.amount,
          status: def.status,
          method: 'bKash',
          details: { mobile: def.mobile, account_number: def.mobile },
          processedBy: def.processedBy?.id ?? null,
          processedAt: def.processedBy ? daysAgo(1) : null,
          processingReference: def.reference,
          decisionNotes: def.notes,
        });
        await payoutRepo.save(row);
        console.log(`  ✓ payout ${def.key}`);
      } else {
        console.log(`  ↻ payout ${def.key}`);
      }
      payouts.set(def.key, row);
    }

    const creditDefs = [
      { user: arif, amount: '5000.00', submissionKey: 'arif-recharge' },
      { user: tanvir, amount: '8000.00', submissionKey: 'tanvir-campus' },
      { user: contrib1, amount: '1000.00', submissionKey: 'contrib1-sample' },
      { user: karim, amount: '4500.00', submissionKey: 'karim-campus' },
    ];

    for (const def of creditDefs) {
      const submission = submissions.get(def.submissionKey)!;
      const reference = `submission:${submission.id}`;
      const existing = await ledgerRepo.findOne({ where: { reference } });
      if (!existing) {
        await ledgerRepo.save(
          ledgerRepo.create({
            userId: def.user.id,
            type: 'reward_credit',
            amount: def.amount,
            status: 'posted',
            reference,
            metadata: { source: 'demo-seed' },
            postedAt: daysAgo(1),
          }),
        );
        console.log(`  ✓ ledger credit ${reference}`);
      } else {
        console.log(`  ↻ ledger credit ${reference}`);
      }
    }

    for (const def of payoutDefs) {
      const payout = payouts.get(def.key)!;
      const reference = `payout:${payout.id}`;
      const existing = await ledgerRepo.findOne({ where: { reference } });
      if (!existing) {
        await ledgerRepo.save(
          ledgerRepo.create({
            userId: def.user.id,
            type: 'payout_hold',
            amount: `-${def.amount}`,
            status: def.holdStatus,
            reference,
            metadata: { source: 'demo-seed' },
            postedAt: def.holdStatus === 'pending' ? null : daysAgo(1),
          }),
        );
        console.log(`  ✓ ledger hold ${reference}`);
      } else {
        console.log(`  ↻ ledger hold ${reference}`);
      }
    }

    const bonusRef = `manual:tanvir-bonus`;
    if (!(await ledgerRepo.findOne({ where: { reference: bonusRef } }))) {
      await ledgerRepo.save(
        ledgerRepo.create({
          userId: tanvir.id,
          type: 'manual_adjustment',
          amount: '500.00',
          status: 'posted',
          reference: bonusRef,
          metadata: { note: 'Campus activation bonus', source: 'demo-seed' },
          postedAt: daysAgo(1),
        }),
      );
      console.log('  ✓ ledger manual adjustment');
    }

    console.log('Leaderboard');
    const leaderboardDefs = [
      { user: tanvir, score: '8500.00', approvals: 1, submissions: 3, streak: 2 },
      { user: arif, score: '5000.00', approvals: 1, submissions: 4, streak: 3 },
      { user: karim, score: '4500.00', approvals: 1, submissions: 3, streak: 1 },
      { user: contrib1, score: '1000.00', approvals: 1, submissions: 2, streak: 1 },
      { user: rafiqul, score: '0.00', approvals: 0, submissions: 2, streak: 0 },
      { user: contrib2, score: '0.00', approvals: 0, submissions: 1, streak: 0 },
    ];
    for (const def of leaderboardDefs) {
      let row = await leaderboardRepo.findOne({
        where: { userId: def.user.id, period: 'all_time' },
      });
      if (!row) {
        row = leaderboardRepo.create({
          userId: def.user.id,
          period: 'all_time',
          score: def.score,
          approvals: def.approvals,
          submissionsCount: def.submissions,
          streak: def.streak,
          lastUpdated: new Date(),
        });
        await leaderboardRepo.save(row);
        console.log(`  ✓ leaderboard ${def.user.email}`);
      } else {
        row.score = def.score;
        row.approvals = def.approvals;
        row.submissionsCount = def.submissions;
        row.streak = def.streak;
        row.lastUpdated = new Date();
        await leaderboardRepo.save(row);
        console.log(`  ↻ leaderboard ${def.user.email}`);
      }
    }

    console.log('Notifications');
    const notificationDefs = [
      {
        recipient: arif,
        type: 'submission_decision' as const,
        title: 'Submission approved — ৳5,000',
        body: 'Your recharge reminder idea was approved.',
        readState: 'unread' as const,
        linked: submissions.get('arif-recharge')!,
        linkedType: 'submission',
      },
      {
        recipient: karim,
        type: 'submission_request_revision' as const,
        title: 'Changes requested on Balance story',
        body: 'Please tighten the copy and resubmit.',
        readState: 'unread' as const,
        linked: submissions.get('karim-balance')!,
        linkedType: 'submission',
      },
      {
        recipient: tanvir,
        type: 'payout_decision' as const,
        title: 'Payout paid — ৳5,000',
        body: 'Your bKash withdrawal was completed.',
        readState: 'read' as const,
        linked: payouts.get('tanvir-paid')!,
        linkedType: 'payout',
      },
      {
        recipient: arif,
        type: 'payout_status_changed' as const,
        title: 'Withdrawal under review',
        body: 'Your ৳2,000 withdrawal is pending.',
        readState: 'unread' as const,
        linked: payouts.get('arif-pending')!,
        linkedType: 'payout',
      },
      {
        recipient: mehedi,
        type: 'application_decision' as const,
        title: 'Application received',
        body: 'We received your IdeaPad application.',
        readState: 'unread' as const,
        linked: null,
        linkedType: null,
      },
      {
        recipient: contrib2,
        type: 'broadcast' as const,
        title: 'New opportunity: Merchant tips',
        body: 'A new financial inclusion concept is live.',
        readState: 'unread' as const,
        linked: concepts.get('merchant')!,
        linkedType: 'concept',
      },
      {
        recipient: imran,
        type: 'system' as const,
        title: '4 submissions awaiting review',
        body: 'Content review queue needs attention.',
        readState: 'unread' as const,
        linked: null,
        linkedType: null,
      },
      {
        recipient: jahidul,
        type: 'access_status_changed' as const,
        title: 'Account suspended',
        body: 'Your contributor access was suspended. Contact support.',
        readState: 'read' as const,
        linked: null,
        linkedType: null,
      },
    ];

    for (const def of notificationDefs) {
      const existing = await notificationRepo.findOne({
        where: {
          recipientId: def.recipient.id,
          title: def.title,
        },
        withDeleted: true,
      });
      if (!existing) {
        await notificationRepo.save(
          notificationRepo.create({
            recipientId: def.recipient.id,
            type: def.type,
            title: def.title,
            body: def.body,
            readState: def.readState,
            readAt: def.readState === 'read' ? daysAgo(1) : null,
            linkedRecordType: def.linkedType,
            linkedRecordId: def.linked?.id ?? null,
            payload: { source: 'demo-seed' },
          }),
        );
        console.log(`  ✓ notification "${def.title}"`);
      } else {
        console.log(`  ↻ notification "${def.title}"`);
      }
    }

    console.log('Audit events');
    const auditDefs = [
      {
        actor: arif,
        action: 'application.submitted',
        targetType: 'application',
        targetId: 'APP-20260301-AC03',
        category: 'applications',
      },
      {
        actor: imran,
        action: 'submission.approve',
        targetType: 'submission',
        targetId: submissions.get('arif-recharge')!.id,
        category: 'submissions',
      },
      {
        actor: admin,
        action: 'submission.approve',
        targetType: 'submission',
        targetId: submissions.get('tanvir-campus')!.id,
        category: 'submissions',
      },
      {
        actor: imran,
        action: 'submission.reject',
        targetType: 'submission',
        targetId: submissions.get('mehedi-coverage')!.id,
        category: 'submissions',
      },
      {
        actor: tanvir,
        action: 'payout.created',
        targetType: 'payout',
        targetId: payouts.get('tanvir-paid')!.id,
        category: 'payouts',
      },
      {
        actor: imran,
        action: 'payout.mark_paid',
        targetType: 'payout',
        targetId: payouts.get('tanvir-paid')!.id,
        category: 'payouts',
      },
      {
        actor: arif,
        action: 'profile.payout_method_updated',
        targetType: 'user',
        targetId: arif.id,
        category: 'profile',
      },
      {
        actor: admin,
        action: 'concept.published',
        targetType: 'concept',
        targetId: concepts.get('recharge')!.id,
        category: 'concepts',
      },
    ];

    for (const def of auditDefs) {
      const existing = await auditRepo.findOne({
        where: {
          actorId: def.actor.id,
          action: def.action,
          targetId: def.targetId,
        },
      });
      if (!existing) {
        await auditRepo.save(
          auditRepo.create({
            actorId: def.actor.id,
            action: def.action,
            targetType: def.targetType,
            targetId: def.targetId,
            category: def.category,
            context: { source: 'demo-seed' },
          }),
        );
        console.log(`  ✓ audit ${def.action}`);
    } else {
        console.log(`  ↻ audit ${def.action}`);
      }
    }

    console.log('\nSeed complete.');
    console.log(`Password for all users: ${DEFAULT_PASSWORD}`);
    console.log('Try: admin@viva.local · contrib1@viva.local · arif.chowdhury@example.com');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
