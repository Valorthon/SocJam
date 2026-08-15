import { decryptToken, encryptToken, isEncryptedToken } from "@/lib/tokens/crypto";
import { db } from "@/lib/db";

async function main(): Promise<void> {
  const accounts = await db.socialAccount.findMany();
  let encrypted = 0;

  for (const account of accounts) {
    if (isEncryptedToken(account.accessToken)) continue;

    const decrypted = decryptToken(account.accessToken);
    await db.socialAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptToken(decrypted),
        refreshToken: account.refreshToken
          ? isEncryptedToken(account.refreshToken)
            ? account.refreshToken
            : encryptToken(decryptToken(account.refreshToken))
          : null,
      },
    });
    encrypted += 1;
  }

  console.log(`Encrypted ${encrypted} existing account token(s).`);
}

void main()
  .then(async () => {
    await db.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
