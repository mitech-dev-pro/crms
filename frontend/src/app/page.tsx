import { redirect } from "next/navigation";

// "/" has no page of its own; signed-in users land on the dashboard.
export default function Home() {
  redirect("/dashboard");
}
