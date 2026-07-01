import { redirect } from "next/navigation";

// The proxy guards auth; unauthenticated users are bounced to /login.
export default function Home() {
  redirect("/dashboard");
}
