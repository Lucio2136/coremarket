import { StatsSection } from "@/components/StatsSection";
import { TrendsWidget } from "@/components/TrendsWidget";
import { LeaderboardWidget } from "@/components/LeaderboardWidget";
import { NewsPanel } from "@/components/NewsPanel";

export default function NoticiasPage() {
  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto">
      <StatsSection />
      <TrendsWidget />
      <LeaderboardWidget />
      <NewsPanel />
    </div>
  );
}
