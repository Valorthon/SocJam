import { PostDetail } from "@/components/features/posts/PostDetail";
import { getRequiredAppUser } from "@/lib/app-user";

interface PostPageProps {
  params: { id: string };
}

export default async function PostPage({ params }: PostPageProps) {
  const user = await getRequiredAppUser();
  const { id } = params;

  return <PostDetail postId={id} timezone={user.timezone} />;
}
