import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/setup-notice";
import { TopNav } from "@/components/top-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) {
    return <SetupNotice />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders: the proxy already redirects, but never render the
  // shell without a verified user.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav email={user.email ?? "admin"} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}
