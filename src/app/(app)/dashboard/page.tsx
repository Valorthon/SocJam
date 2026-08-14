import { PostHistoryTable } from "@/components/features/posts/PostHistoryTable";
import { getRequiredAppUser } from "@/lib/app-user";

export default async function DashboardPage() {
  const user = await getRequiredAppUser();

  return <PostHistoryTable timezone={user.timezone} />;
}
