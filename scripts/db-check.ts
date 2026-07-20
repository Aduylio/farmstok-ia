import { prisma } from '../src/config/prisma.js';

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log('Conexão com PostgreSQL OK.');
} catch {
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
