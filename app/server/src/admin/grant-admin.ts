import { PrismaService } from '../prisma/prisma.service';

export async function grantAdmin(prisma: PrismaService, email: string) {
  if (await prisma.user.findFirst({ where: { isAdmin: true }, select: { id: true } })) {
    throw new Error('An administrator already exists');
  }
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    throw new Error('No account uses that email address');
  }
  if (!user.verifiedAt || !user.isActive) {
    throw new Error('The account must be verified and active');
  }
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  return `${user.handle} is now the administrator`;
}
