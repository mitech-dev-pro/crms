import type { Screen } from "@crms/shared";
import { Card } from "../ui/Card";
import { RequirePerm } from "./SessionGate";

/** Placeholder for screens built in Phase 6. Still permission-checked, so the nav and 403 behave correctly. */
export default function ComingSoon({ screen, title, description }: { screen: Screen; title: string; description: string }) {
  return (
    <RequirePerm screen={screen}>
      <Card className="p-8 text-center">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
        <p className="mt-4 text-xs font-bold tracking-wide text-teal uppercase">Coming in Phase 6</p>
      </Card>
    </RequirePerm>
  );
}
