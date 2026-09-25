import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { grantAdmin } from './grant-admin';

async function run(email: string | undefined) {
  if (!email) {
    throw new Error('Usage: npm run admin:grant --workspace server -- <email>');
  }
  const context = await NestFactory.createApplicationContext(PrismaModule, { logger: false });
  try {
    return await grantAdmin(context.get(PrismaService), email);
  } finally {
    await context.close();
  }
}

run(process.argv[2])
  .then((message) => console.log(message))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
