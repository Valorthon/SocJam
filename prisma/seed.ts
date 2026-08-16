import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = "dev@socjam.local";

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`Seed user ${email} already exists. Skipping.`);
    return;
  }

  const passwordHash = await argon2.hash("password123");

  await prisma.user.create({
    data: {
      email,
      name: "Dev User",
      passwordHash,
      timezone: "UTC",
    },
  });

  console.log(`Created seed user: ${email} / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
