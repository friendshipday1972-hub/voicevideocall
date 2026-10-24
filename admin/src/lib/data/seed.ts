/**
 * Deterministic demo dataset: 30 days of activity for the 12 hosts in the mobile app
 * (same names and Spotlight stats, so scores match on both sides) plus ~180 callers.
 * Replaced by Supabase queries once the real backend is connected.
 */
import type { AppConfig, Application, AuditEntry, Call, CallEndReason, Dataset, Host, LanguageCode, Payout, Purchase, Report, ReportCategory, User } from './types';
import { CATEGORY_SEVERITY } from './types';

const DAY = 86_400_000;

/** mulberry32: small seeded PRNG so every fresh demo looks the same. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  coinValuePaise: 75,
  audioRate: 6,
  videoRate: 10,
  hostShareBps: [3500, 4000, 4500, 5000],
  giftShareBps: 6000,
  minWithdrawalPaise: 50_000,
  holdDays: 7,
  trialCoins: 6,
  refundUnderSeconds: 10,
  spotlightMinScore: 60,
};

// name, age, city, languages, level, rating, ratingCount, [repeat, avgMin, answer, report, activeDays, calls30d], colors, bio
const HOST_SEED: [string, number, string, LanguageCode[], 1 | 2 | 3 | 4, number, number, [number, number, number, number, number, number], [string, string], string][] = [
  ['Ananya', 24, 'Hyderabad', ['te', 'hi', 'en'], 4, 4.8, 1240, [0.41, 12.5, 0.96, 0.001, 26, 420], ['#F472B6', '#7C3AED'], 'Movie buff and chai lover.'],
  ['Priya', 26, 'Chennai', ['ta', 'en'], 3, 4.7, 860, [0.33, 10, 0.92, 0.002, 22, 260], ['#FB923C', '#E11D48'], 'Carnatic music student. Good listener.'],
  ['Kavya', 23, 'Bengaluru', ['kn', 'en', 'hi'], 3, 4.6, 540, [0.28, 9, 0.89, 0.003, 18, 180], ['#34D399', '#0EA5E9'], 'Techie by day, foodie by night.'],
  ['Meera', 27, 'Kochi', ['ml', 'en'], 4, 4.9, 1530, [0.45, 14, 0.98, 0.0005, 27, 480], ['#A78BFA', '#DB2777'], 'Yoga, poetry and long conversations.'],
  ['Riya', 22, 'Delhi', ['hi', 'en'], 2, 4.5, 310, [0.25, 8, 0.87, 0.004, 16, 120], ['#FBBF24', '#F43F5E'], 'Cricket fan. Let’s laugh a little.'],
  ['Sneha', 25, 'Pune', ['mr', 'hi', 'en'], 2, 4.4, 190, [0.2, 7, 0.84, 0.018, 10, 70], ['#2DD4BF', '#6366F1'], 'Marathi theatre and weekend treks.'],
  ['Ishita', 24, 'Kolkata', ['bn', 'hi', 'en'], 3, 4.7, 670, [0.35, 11, 0.93, 0.002, 21, 230], ['#F87171', '#9333EA'], 'Rabindra sangeet and adda.'],
  ['Divya', 28, 'Vijayawada', ['te', 'hi'], 2, 4.6, 420, [0.3, 10, 0.9, 0.003, 19, 160], ['#60A5FA', '#E11D48'], 'Teacher who loves to listen.'],
  ['Lakshmi', 26, 'Madurai', ['ta', 'te'], 1, 4.3, 88, [0.38, 11, 0.9, 0.001, 14, 38], ['#FCA5A5', '#F59E0B'], 'Let’s talk career and life.'],
  ['Neha', 23, 'Mumbai', ['hi', 'mr', 'en'], 4, 4.8, 990, [0.4, 12, 0.95, 0.001, 25, 380], ['#F0ABFC', '#BE123C'], 'Fashion student and dog mom.'],
  ['Aishwarya', 25, 'Mysuru', ['kn', 'te'], 2, 4.5, 260, [0.22, 7.5, 0.86, 0.005, 12, 90], ['#86EFAC', '#7C3AED'], 'Classical dancer. Calm vibes only.'],
  ['Anjali', 24, 'Thrissur', ['ml', 'ta', 'en'], 1, 4.2, 64, [0.36, 10.5, 0.88, 0, 15, 30], ['#FDE68A', '#DB2777'], 'Football and filter coffee.'],
];

const MALE_NAMES = ['Rahul', 'Arjun', 'Vikram', 'Sai', 'Karthik', 'Aman', 'Rohit', 'Aditya', 'Varun', 'Nikhil', 'Suresh', 'Manoj', 'Deepak', 'Harish', 'Ravi', 'Kiran', 'Pranav', 'Siddharth', 'Gaurav', 'Akash', 'Naveen', 'Vivek', 'Ajay', 'Sanjay', 'Abhishek', 'Tarun', 'Mohit', 'Yash', 'Ankit', 'Rakesh'];
const SURNAME_INITIAL = 'ABCDGKMNPRSTV';
const CITIES = ['Hyderabad', 'Bengaluru', 'Chennai', 'Mumbai', 'Delhi', 'Pune', 'Kolkata', 'Kochi', 'Vizag', 'Coimbatore', 'Jaipur', 'Lucknow', 'Indore', 'Nagpur'];
const LANGS: LanguageCode[] = ['hi', 'te', 'ta', 'kn', 'ml', 'bn', 'mr', 'en'];
const DEVICES = ['Redmi Note 13', 'Samsung M34', 'Realme 12', 'Vivo Y28', 'iPhone 13', 'OnePlus Nord', 'Poco X6', 'Oppo A79'];
const PACKS: [string, number, number][] = [
  ['Starter', 3000, 40],
  ['Basic', 9900, 150],
  ['Plus', 29900, 500],
  ['Max', 99900, 1800],
];
const TAGS = ['Friendly', 'Good listener', 'Funny', 'Respectful', 'Great advice', 'Clear voice'];
const COMMENTS_GOOD = [
  'Felt like talking to an old friend. Made my evening.',
  'Gave me really practical advice about my job switch.',
  'Very polite and easy to talk to.',
  'Laughed the whole call. Calling again tomorrow!',
  'Patient and kind. Helped me relax after a long day.',
  'Remembered what we spoke about last time. Loved that.',
  'Best conversation I have had in weeks.',
  'Speaks Telugu so naturally, felt like home.',
];
const COMMENTS_MEH = ['Nice chat, but the call felt a bit short.', 'Network was bad on her side.', 'Okay, but seemed distracted.'];
const COMMENTS_BAD = ['Kept asking me to send gifts.', 'Ended the call suddenly.', 'Not interested in talking.'];

export function generateDataset(now: number): Dataset {
  const r = rng(20261022);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  const int = (min: number, max: number) => Math.floor(min + r() * (max - min + 1));
  const phone = () => `+91 ${int(6, 9)}${String(int(0, 99999999)).padStart(8, '0').replace(/(\d{4})(\d{4})/, '$1 $2')}`;

  // Hosts
  const hosts: Host[] = HOST_SEED.map(([name, age, city, languages, level, ratingAvg, ratingCount, s, colors, bio], i) => ({
    id: `h${i + 1}`,
    name,
    age,
    city,
    phone: phone(),
    languages,
    bio,
    level,
    levelOverride: null,
    status: 'active',
    presence: pick(['online', 'online', 'busy', 'offline'] as const),
    featured: i === 6,
    joinedAt: now - int(40, 400) * DAY,
    stats: { ratingAvg, ratingCount, repeatCallerRate: s[0], avgCallMinutes: s[1], answerRate: s[2], reportRate: s[3], activeDays: s[4], calls30d: s[5] },
    strikes: 0,
    kyc: { pan: `${'ABCDEFGHJK'[i % 10]}${'KLMNP'[i % 5]}QPR${int(1000, 9999)}${'FGHJK'[i % 5]}`, aadhaarLast4: String(int(1000, 9999)), faceMatch: int(91, 99) },
    payout: r() < 0.7 ? `UPI · ${name.toLowerCase()}@ok${pick(['axis', 'sbi', 'hdfc', 'icici'])}` : `Bank · A/c ••${int(1000, 9999)}`,
    colors,
  }));

  // Callers
  const users: User[] = Array.from({ length: 184 }, (_, i) => {
    const joinedAt = now - Math.floor(r() ** 1.6 * 120 * DAY) - int(0, DAY);
    return {
      id: `u${i + 1}`,
      name: `${pick(MALE_NAMES)} ${pick(SURNAME_INITIAL.split(''))}.`,
      phone: phone(),
      age: int(19, 45),
      city: pick(CITIES),
      languages: Array.from(new Set([pick(LANGS), r() < 0.5 ? 'en' : pick(LANGS)])) as LanguageCode[],
      joinedAt,
      lastActiveAt: Math.min(now, joinedAt + int(0, Math.max(1, Math.floor((now - joinedAt) / DAY))) * DAY + int(0, DAY)),
      status: 'active',
      coins: 0,
      spentPaise: 0,
      device: pick(DEVICES),
      flags: [],
    };
  });

  // Purchases
  const purchases: Purchase[] = [];
  const buyers = users.filter(() => r() < 0.62);
  for (const u of buyers) {
    const n = int(1, 6);
    for (let k = 0; k < n; k++) {
      const [pack, pricePaise, coins] = PACKS[Math.min(3, Math.floor(r() ** 2.2 * 4))];
      const createdAt = Math.min(now - 60_000, u.joinedAt + Math.floor(r() * (now - u.joinedAt)));
      if (createdAt < now - 30 * DAY) continue;
      purchases.push({ id: `p${purchases.length + 1}`, userId: u.id, pack, pricePaise, coins, platform: r() < 0.88 ? 'android' : 'ios', createdAt, status: r() < 0.015 ? 'refunded' : 'verified' });
      u.spentPaise += pricePaise;
      u.coins += coins;
    }
  }

  // Calls: volume per host follows her calls30d; busier evenings (7pm–midnight).
  const calls: Call[] = [];
  const payingUsers = users.filter((u) => u.spentPaise > 0);
  for (const h of hosts) {
    const n = Math.round(h.stats.calls30d / 2.5);
    for (let k = 0; k < n; k++) {
      const day = Math.floor(r() * 30);
      const hour = r() < 0.65 ? int(19, 23) : int(9, 18);
      const startedAt = now - day * DAY - ((new Date(now).getHours() - hour + 24) % 24) * 3_600_000 - int(0, 3_599_000);
      if (startedAt > now) continue;
      // Only callers who had already joined; regulars of this host come back more often.
      const eligible = payingUsers.filter((x) => x.joinedAt <= startedAt);
      if (eligible.length === 0) continue;
      const u = eligible[Math.floor((r() < h.stats.repeatCallerRate ? r() * 0.25 : r()) * eligible.length)];
      const type = r() < 0.38 ? 'video' : 'audio';
      const short = r() < 0.04;
      const durationSec = short ? int(3, 9) : Math.max(20, Math.round((-Math.log(1 - r()) * h.stats.avgCallMinutes) * 60));
      const rate = type === 'audio' ? 6 : 10;
      const minutes = Math.floor(durationSec / 60) + 1;
      const coins = short ? 0 : minutes * rate;
      const refundedCoins = short ? rate : 0;
      const giftCoins = r() < 0.12 ? pick([10, 20, 30, 50, 100]) : 0;
      const shareBps = DEFAULT_CONFIG.hostShareBps[h.level - 1];
      const hostEarnedPaise = Math.floor((coins * 75 * shareBps) / 10_000) + Math.floor((giftCoins * 75 * DEFAULT_CONFIG.giftShareBps) / 10_000);
      const endReason: CallEndReason = short ? 'network' : r() < 0.08 ? 'low_balance' : r() < 0.55 ? 'caller_hangup' : 'host_hangup';
      const call: Call = { id: `c${calls.length + 1}`, userId: u.id, hostId: h.id, type, language: pick(h.languages), startedAt, durationSec, coins, refundedCoins, giftCoins, hostEarnedPaise, endReason };
      if (!short && r() < 0.62) {
        // Star mix tracks the host's average (e.g. 4.8 → mostly 5s, 4.3 → mostly 4s).
        const p5 = Math.min(0.92, Math.max(0.2, h.stats.ratingAvg - 3.95));
        const roll = r();
        const stars = roll < p5 ? 5 : roll < p5 + (1 - p5) * 0.75 ? 4 : roll < p5 + (1 - p5) * 0.93 ? 3 : int(1, 2);
        call.rating = stars;
        call.tags = stars >= 4 ? Array.from(new Set([pick(TAGS), pick(TAGS)])) : [];
        if (r() < 0.35) call.comment = stars >= 4 ? pick(COMMENTS_GOOD) : stars === 3 ? pick(COMMENTS_MEH) : pick(COMMENTS_BAD);
      }
      calls.push(call);
      u.coins = Math.max(0, u.coins - coins - giftCoins);
    }
  }
  calls.sort((a, b) => b.startedAt - a.startedAt);
  for (const u of users) {
    const last = calls.find((c) => c.userId === u.id);
    if (last) u.lastActiveAt = Math.max(u.lastActiveAt, last.startedAt + last.durationSec * 1000);
  }

  // A few problem accounts for the moderation demo.
  users[7].flags.push('Repeated reports');
  users[23].status = 'suspended';
  users[41].flags.push('Multiple accounts on one device');

  // Reports: [category, who is reported, hours ago]. The reporter is the other side of that call.
  const reportPlan: [ReportCategory, 'user' | 'host', number][] = [
    ['sharing_contacts', 'user', 5],
    ['sexual_content', 'host', 7],
    ['fraud', 'host', 10],
    ['harassment', 'user', 14],
    ['abuse', 'user', 3],
    ['spam', 'host', 20],
    ['underage', 'user', 2],
    ['harassment', 'user', 30],
    ['sharing_contacts', 'host', 26],
    ['other', 'host', 60],
    ['abuse', 'user', 80],
    ['fraud', 'user', 96],
  ];
  const DETAILS: Record<ReportCategory, string> = {
    sharing_contacts: 'Asked for my WhatsApp number twice during the call.',
    sexual_content: 'Made inappropriate comments and asked to switch the camera on.',
    fraud: 'Asked me to pay on UPI outside the app for a longer call.',
    harassment: 'Kept calling back after I ended the call and used rude words.',
    abuse: 'Used abusive language when the call was ending.',
    spam: 'Promoting another app during the call.',
    underage: 'Voice sounded very young; said she is in school.',
    other: 'Coins were cut but the other side could not hear me.',
  };
  const reports: Report[] = reportPlan.map(([category, targetRole, hoursAgo], i) => {
    // Pin a couple of reports to Sneha (h6) so her at-risk score has a visible cause.
    const pool = (i === 1 || i === 8) ? calls.filter((c) => c.hostId === 'h6') : calls;
    const call = pool[int(0, Math.min(pool.length - 1, 150))];
    const reporterRole = targetRole === 'host' ? 'user' : 'host';
    const resolved = i >= 9;
    return {
      id: `r${i + 1}`,
      reporterId: reporterRole === 'user' ? call.userId : call.hostId,
      reporterRole,
      targetId: targetRole === 'host' ? call.hostId : call.userId,
      targetRole,
      callId: call.id,
      category,
      details: DETAILS[category],
      severity: CATEGORY_SEVERITY[category],
      status: resolved ? 'actioned' : 'open',
      createdAt: now - hoursAgo * 3_600_000,
      decision: resolved ? 'warn' : undefined,
      resolvedAt: resolved ? now - (hoursAgo - 6) * 3_600_000 : undefined,
    };
  });

  // KYC applications from women who want to host
  const applications: Application[] = [
    ['Pooja', 24, 'Hyderabad', ['te', 'en'], 97, true, null, 'female', 24],
    ['Swathi', 27, 'Chennai', ['ta', 'te'], 94, true, null, 'female', 27],
    ['Ritika', 22, 'Delhi', ['hi', 'en'], 71, true, null, 'female', 22],
    ['Bhavana', 25, 'Bengaluru', ['kn', 'en'], 96, true, 'h3', 'female', 25],
    ['Shruti', 29, 'Pune', ['mr', 'hi'], 98, false, null, 'female', 29],
    ['Nandini', 23, 'Kochi', ['ml', 'en'], 95, true, null, 'female', 17],
    ['Harini', 26, 'Vizag', ['te', 'hi'], 99, true, null, 'female', 26],
  ].map(([name, age, city, languages, faceMatch, liveness, dup, gender, aadhaarAge], i) => ({
    id: `a${i + 1}`,
    name: name as string,
    age: age as number,
    city: city as string,
    phone: phone(),
    languages: languages as LanguageCode[],
    bio: 'I love talking about movies, food and life. Looking forward to meeting new people.',
    pan: `${'BCDFG'[i % 5]}${'HJKLM'[i % 5]}TPR${int(1000, 9999)}${'QRSTV'[i % 5]}`,
    aadhaarLast4: String(int(1000, 9999)),
    aadhaarGender: gender as 'female',
    aadhaarAge: aadhaarAge as number,
    faceMatch: faceMatch as number,
    livenessPassed: liveness as boolean,
    duplicateOf: dup as string | null,
    payout: `UPI · ${(name as string).toLowerCase()}@okaxis`,
    submittedAt: now - int(1, 40) * 3_600_000,
    status: 'pending',
  }));

  // Payouts: weekly requests from hosts with balance
  const payouts: Payout[] = hosts.slice(0, 9).map((h, i) => {
    const amountPaise = int(6, 60) * 10_000;
    return {
      id: `po${i + 1}`,
      hostId: h.id,
      amountPaise,
      tdsPaise: Math.round(amountPaise * 0.01),
      method: h.payout,
      status: i < 5 ? 'requested' : i < 7 ? 'approved' : 'paid',
      requestedAt: now - int(1, 72) * 3_600_000,
      decidedAt: i < 5 ? undefined : now - int(1, 20) * 3_600_000,
    };
  });

  const audit: AuditEntry[] = [{ id: 'au0', at: now, actor: 'system', action: 'demoGenerated', vars: { users: users.length, hosts: hosts.length, calls: calls.length }, targetType: 'system', targetId: '-', detail: '' }];

  return { generatedAt: now, users, hosts, applications, calls, purchases, payouts, reports, audit, config: DEFAULT_CONFIG };
}
