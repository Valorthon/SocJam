import { Composer } from "@/components/features/composer/Composer";
import { getRequiredAppUser } from "@/lib/app-user";

export default async function ComposePage() {
  const user = await getRequiredAppUser();

  return <Composer timezone={user.timezone} />;
}
