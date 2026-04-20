import { PricesWidget } from "@/components/PricesWidget";
import { StockWidget } from "@/components/StockWidget";
import { TrendsWidget } from "@/components/TrendsWidget";
import { LeaderboardWidget } from "@/components/LeaderboardWidget";
import { NewsPanel } from "@/components/NewsPanel";

export default function NoticiasPage() {
  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto">
      <PricesWidget />
      <StockWidget />
      <TrendsWidget />
      <LeaderboardWidget />
      <NewsPanel />
    </div>
  );
}
