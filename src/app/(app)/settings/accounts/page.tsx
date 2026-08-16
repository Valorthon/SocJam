import AccountsSettingsClient from "@/app/(app)/settings/accounts/AccountsSettingsClient";
import { getRequiredAppUser } from "@/lib/app-user";

export default async function ConnectedAccountsPage() {
  const user = await getRequiredAppUser();

  return <AccountsSettingsClient timezone={user.timezone} />;
}
