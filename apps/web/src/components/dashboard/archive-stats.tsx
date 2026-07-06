"use client";

import { FileText, CheckCircle2, Clock, Gauge, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useArchiveStats } from "@/lib/queries";
import { formatConfidence } from "@/lib/utils";

export function ArchiveStats() {
  const { data: stats, isLoading, error, refetch } = useArchiveStats();

  // Surface fetch failures inline rather than rendering zeros — a zero here
  // would lie about the archive state when the API is simply unreachable.
  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={error} onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  const cards = [
    { title: "Documents", value: stats?.total_documents ?? 0, icon: FileText },
    { title: "Pages Processed", value: stats?.pages_processed ?? 0, icon: CheckCircle2 },
    { title: "Pending", value: stats?.pending ?? 0, icon: Clock },
    { title: "Avg Confidence", value: formatConfidence(stats?.avg_confidence), icon: Gauge },
    { title: "Storage Used", value: stats?.storage_human ?? "0 B", icon: HardDrive },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card, i) => (
        <Card
          key={card.title}
          className={`card-hover animate-fade-in-up stagger-${i + 1}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pt-4 pb-2 px-4 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className="stat-icon-wrap">
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-5 px-4">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="stat-value">{card.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
