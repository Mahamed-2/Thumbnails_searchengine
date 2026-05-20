import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up existing data to ensure idempotency
  await prisma.thumbnail.deleteMany();
  await prisma.dLQEntry.deleteMany();
  await prisma.collectionJob.deleteMany();
  await prisma.user.deleteMany();
  await prisma.game.deleteMany();
  await prisma.datasetExport.deleteMany();
  await prisma.collectionStat.deleteMany();

  // 1. Seed Users
  console.log(' seeding users...');
  const user1 = await prisma.user.create({
    data: { robloxId: 1, name: 'Roblox', displayName: 'Roblox' }
  });
  const user2 = await prisma.user.create({
    data: { robloxId: 156, name: 'Builderman', displayName: 'Builderman' }
  });
  const user3 = await prisma.user.create({
    data: { robloxId: 26163996, name: 'AhlamDev', displayName: 'Ahlam' }
  });

  // 2. Seed Games
  console.log(' seeding games...');
  await prisma.game.create({
    data: {
      robloxId: 1884,
      name: 'Work at a Pizza Place',
      creatorId: 156,
      creatorType: 'User',
      visits: BigInt(4500000000),
      playing: 12500,
      thumbnailUrl: 'https://images.rbxcdn.com/pizza_place.png'
    }
  });

  await prisma.game.create({
    data: {
      robloxId: 9243,
      name: 'Theme Park Tycoon 2',
      creatorId: 157,
      creatorType: 'User',
      visits: BigInt(1200000000),
      playing: 8400,
      thumbnailUrl: 'https://images.rbxcdn.com/theme_park.png'
    }
  });

  // 3. Seed Collection Jobs
  console.log(' seeding collection jobs...');
  const completedJob = await prisma.collectionJob.create({
    data: {
      name: 'Initial Roblox Creator Crawl',
      status: 'completed',
      strategy: 'user-range',
      config: JSON.stringify({ startUserId: 1, endUserId: 200, sizes: ['150x150', '420x420'], cropTypes: ['avatar'] }),
      totalItems: 3,
      processedItems: 3,
      successItems: 3,
      failedItems: 0,
      progress: 100.0,
      startedAt: new Date(Date.now() - 3600 * 1000),
      completedAt: new Date(),
    }
  });

  const failedJob = await prisma.collectionJob.create({
    data: {
      name: 'Broken User Batch Collection',
      status: 'failed',
      strategy: 'user-range',
      config: JSON.stringify({ startUserId: 9999990, endUserId: 9999999, sizes: ['720x720'], cropTypes: ['avatar-headshot'] }),
      totalItems: 10,
      processedItems: 4,
      successItems: 0,
      failedItems: 4,
      progress: 40.0,
      errorLog: 'API request limits reached on Roblox servers',
      startedAt: new Date(Date.now() - 7200 * 1000),
      completedAt: new Date(Date.now() - 7000 * 1000),
    }
  });

  // 4. Seed DLQ Entries for the failed job
  console.log(' seeding DLQ entries...');
  await prisma.dLQEntry.create({
    data: {
      jobId: failedJob.id,
      queueName: 'thumbnail-collection',
      payload: JSON.stringify({ userId: 9999991, size: '720x720', cropType: 'avatar-headshot' }),
      error: 'Roblox API 500: Server error during rendering',
      attempts: 3
    }
  });

  // 5. Seed Thumbnails
  console.log(' seeding thumbnails...');
  await prisma.thumbnail.create({
    data: {
      userId: 1,
      imageUrl: 'https://images.rbxcdn.com/roblox_thumb.png',
      size: '420x420',
      format: 'png',
      cropType: 'avatar',
      state: 'Completed',
      jobId: completedJob.id,
      fileSizeKb: 45,
      width: 420,
      height: 420,
      quality: 85
    }
  });

  await prisma.thumbnail.create({
    data: {
      userId: 156,
      imageUrl: 'https://images.rbxcdn.com/builderman_thumb.png',
      size: '420x420',
      format: 'png',
      cropType: 'avatar',
      state: 'Completed',
      jobId: completedJob.id,
      fileSizeKb: 42,
      width: 420,
      height: 420,
      quality: 88
    }
  });

  // 6. Seed Collection Stats (past 7 days for graphing)
  console.log(' seeding collection stats...');
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    await prisma.collectionStat.create({
      data: {
        date,
        totalThumbnails: 120 + (6 - i) * 35,
        totalGames: 2 + (6 - i) * 1,
        totalUsers: 3 + (6 - i) * 4,
        storageUsedMb: 5.4 + (6 - i) * 1.8,
        duplicatesFound: 2 + (6 - i),
        errorsTotal: i === 0 ? 1 : 0,
        apiRequestsMade: 150 + (6 - i) * 60,
      }
    });
  }

  console.log('🌱 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
