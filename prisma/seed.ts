import { PrismaClient, TournamentFormat } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedWalletDemo } from "@/lib/wallet-demo";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed the database.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const games = [
  { slug: "valorant", name: "VALORANT", category: "تیراندازی رقابتی", description: "بازی رقابتی پنج‌به‌پنج", platforms: ["PC"], integrationType: "MANUAL" },
  { slug: "fc-25", name: "EA SPORTS FC 25", category: "ورزشی", description: "رقابت فوتبال یک‌به‌یک", platforms: ["PlayStation", "Xbox", "PC"], integrationType: "MANUAL" },
  { slug: "pubg-mobile", name: "PUBG MOBILE", category: "بتل رویال", description: "بازی بتل‌رویال موبایل", platforms: ["iOS", "Android"], integrationType: "MANUAL" },
] as const;

async function seed() {
  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: { name: game.name, category: game.category, description: game.description, platforms: [...game.platforms], integrationType: game.integrationType },
      create: { ...game, platforms: [...game.platforms], isEnabled: true },
    });
  }

  for (const [name, permissions] of [
    ["SUPER_ADMIN", ["*"]],
    ["TOURNAMENT_MANAGER", ["tournaments:read", "tournaments:write", "matches:write"]],
    ["SUPPORT", ["users:read", "notifications:write"]],
  ] as const) {
    await prisma.adminRole.upsert({ where: { name }, update: { permissions: [...permissions] }, create: { name, permissions: [...permissions] } });
  }

  const systemAccount = await prisma.walletAccount.findFirst({ where: { userId: null, accountType: "SYSTEM", currency: "GMO" } });
  if (!systemAccount) await prisma.walletAccount.create({ data: { userId: null, accountType: "SYSTEM", currency: "GMO" } });
  await prisma.walletAccount.updateMany({ where: { userId: null, accountType: "SYSTEM", currency: "GMO" }, data: { isActive: true } });

  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const missionData = [
    { slug: "complete-three-matches", title: "یک مسابقه را کامل کن", description: "سه مسابقه را کامل کن.", missionType: "COMPLETE_MATCHES", reward: 120n, requirements: { target: 3 } },
    { slug: "discover-a-game", title: "یک بازی جدید کشف کن", description: "یک بازی را به حساب خود اضافه کن.", missionType: "DISCOVER_GAME", reward: 80n, requirements: { target: 1 } },
  ] as const;
  for (const mission of missionData) {
    await prisma.mission.upsert({
      where: { slug: mission.slug },
      update: { title: mission.title, description: mission.description, missionType: mission.missionType, reward: mission.reward, requirements: mission.requirements, status: "ACTIVE" },
      create: { ...mission, startsAt: startedAt, status: "ACTIVE" },
    });
  }

  await prisma.achievement.upsert({
    where: { slug: "first-tournament" },
    update: { title: "اولین رقابت", description: "در اولین مسابقهٔ رسمی شرکت کن.", isActive: true },
    create: { slug: "first-tournament", title: "اولین رقابت", description: "در اولین مسابقهٔ رسمی شرکت کن.", requirements: { completedTournaments: 1 } },
  });

  const catalog = await prisma.game.findUniqueOrThrow({ where: { slug: "valorant" } });
  await prisma.tournament.upsert({
    where: { slug: "seed-weekly-valorant-cup" },
    update: {},
    create: {
      gameId: catalog.id,
      title: "جام هفتگی VALORANT (نمونه)",
      slug: "seed-weekly-valorant-cup",
      description: "دادهٔ نمونه برای محیط توسعه؛ پیش از انتشار آن را ویرایش کنید.",
      format: TournamentFormat.SINGLE_ELIMINATION,
      status: "DRAFT",
      registrationStartsAt: new Date("2030-01-01T00:00:00.000Z"),
      registrationEndsAt: new Date("2030-01-07T00:00:00.000Z"),
      startsAt: new Date("2030-01-08T00:00:00.000Z"),
      maxParticipants: 16,
      entryFee: 0n,
      prizePool: 0n,
      demoContent: true,
    },
  });

  await seedSportingPredictions();
  await seedWalletDemo(prisma);
}



async function seedSportingPredictions() {
  // Add future sports and competitions to this generic event-fixture-market structure.
  const events = [
    {
      sport: "football",
      competition: "جام جهانی فوتبال",
      season: "نمونهٔ آینده",
      name: "جام جهانی فوتبال (نمونه)",
      slug: "demo-football-world-cup",
      description: "رویداد و بازارهای پیش‌بینی نمایشی؛ نتایج و زمان‌بندی رسمی نیستند.",
      startsAt: new Date("2030-06-01T00:00:00.000Z"),
      endsAt: new Date("2030-07-31T23:59:59.000Z"),
      metadata: { demo: true, format: "team-tournament" },
      fixtures: [{
        externalId: "demo-football-match-1",
        name: "مسابقهٔ فوتبال نمونه",
        stage: "مرحلهٔ گروهی (نمونه)",
        startsAt: new Date("2030-06-11T18:00:00.000Z"),
        participantA: "تیم الف (نمونه)",
        participantB: "تیم ب (نمونه)",
        marketSlug: "match-winner",
        marketTitle: "نتیجهٔ مسابقه",
        marketType: "MATCH_WINNER",
        options: [
          { slug: "team-a", label: "برد تیم الف", sortOrder: 0 },
          { slug: "draw", label: "مساوی", sortOrder: 1 },
          { slug: "team-b", label: "برد تیم ب", sortOrder: 2 },
        ],
      }],
    },
    {
      sport: "wrestling",
      competition: "رقابت‌های کشتی",
      season: "نمونهٔ آینده",
      name: "مسابقات کشتی (نمونه)",
      slug: "demo-wrestling-championship",
      description: "نمونهٔ عمومی برای رقابت‌های کشتی و پیش‌بینی برندهٔ مبارزه.",
      startsAt: new Date("2030-09-01T00:00:00.000Z"),
      endsAt: new Date("2030-09-10T23:59:59.000Z"),
      metadata: { demo: true, format: "individual-bracket" },
      fixtures: [{
        externalId: "demo-wrestling-bout-1",
        name: "مبارزهٔ کشتی نمونه",
        stage: "دور مقدماتی (نمونه)",
        startsAt: new Date("2030-09-02T14:00:00.000Z"),
        participantA: "کشتی‌گیر الف (نمونه)",
        participantB: "کشتی‌گیر ب (نمونه)",
        marketSlug: "bout-winner",
        marketTitle: "برندهٔ مبارزه",
        marketType: "MATCH_WINNER",
        options: [
          { slug: "wrestler-a", label: "برد کشتی‌گیر الف", sortOrder: 0 },
          { slug: "wrestler-b", label: "برد کشتی‌گیر ب", sortOrder: 1 },
        ],
      }],
    },
    {
      sport: "multi-sport",
      competition: "بازی‌های المپیک",
      season: "نمونهٔ آینده",
      name: "بازی‌های المپیک (نمونه)",
      slug: "demo-olympic-games",
      description: "رویداد چندرشته‌ای نمایشی؛ مسابقه‌ها و شرکت‌کنندگان فرضی هستند.",
      startsAt: new Date("2032-07-01T00:00:00.000Z"),
      endsAt: new Date("2032-08-31T23:59:59.000Z"),
      metadata: { demo: true, sports: ["athletics", "swimming", "wrestling", "football"] },
      fixtures: [{
        externalId: "demo-olympic-medal-leader",
        name: "پیش‌بینی جدول مدال‌ها (نمونه)",
        stage: "رده‌بندی کلی (نمونه)",
        startsAt: new Date("2032-08-31T18:00:00.000Z"),
        marketSlug: "medal-leader",
        marketTitle: "صدرنشین فرضی جدول مدال‌ها",
        marketType: "TOURNAMENT_WINNER",
        options: [
          { slug: "country-a", label: "کشور الف (نمونه)", sortOrder: 0 },
          { slug: "country-b", label: "کشور ب (نمونه)", sortOrder: 1 },
          { slug: "country-c", label: "کشور ج (نمونه)", sortOrder: 2 },
        ],
      }],
    },
  ] as const;

  for (const eventSeed of events) {
    const { fixtures, ...eventData } = eventSeed;
    const event = await prisma.sportingEvent.upsert({
      where: { slug: eventSeed.slug },
      update: { ...eventData, status: "SCHEDULED", isDemo: true },
      create: { ...eventData, status: "SCHEDULED", isDemo: true },
    });

    for (const fixtureSeed of fixtures) {
      const { marketSlug, marketTitle, marketType, options, ...fixtureData } = fixtureSeed;
      const fixture = await prisma.sportingFixture.upsert({
        where: { eventId_externalId: { eventId: event.id, externalId: fixtureSeed.externalId } },
        update: { ...fixtureData, status: "SCHEDULED", metadata: { demo: true } },
        create: { ...fixtureData, eventId: event.id, status: "SCHEDULED", metadata: { demo: true } },
      });
      const description = "بازار نمایشی برای توسعه و آزمایش؛ شرط‌بندی یا جایزهٔ واقعی فعال نیست.";
      const market = await prisma.predictionMarket.upsert({
        where: { fixtureId_slug: { fixtureId: fixture.id, slug: marketSlug } },
        update: { title: marketTitle, description, marketType, lockAt: fixture.startsAt, status: "DRAFT", isDemo: true },
        create: { fixtureId: fixture.id, slug: marketSlug, title: marketTitle, description, marketType, lockAt: fixture.startsAt, status: "DRAFT", isDemo: true },
      });

      for (const option of options) {
        await prisma.predictionOption.upsert({
          where: { marketId_slug: { marketId: market.id, slug: option.slug } },
          update: { label: option.label, sortOrder: option.sortOrder },
          create: { marketId: market.id, ...option },
        });
      }
    }
  }
}

seed()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error("Database seed failed.", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
