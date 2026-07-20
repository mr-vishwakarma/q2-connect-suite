import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${count > 4 ? 4 : count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="bg-card border-border">
          <CardContent className="p-4 sm:p-6 flex items-center justify-between">
            <div className="space-y-3 w-full">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-1/3" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full shrink-0 ml-4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="bg-card border-border w-full">
      <CardHeader className="border-b border-border/50 pb-4 mb-4">
        <Skeleton className="h-6 w-1/4" />
      </CardHeader>
      <CardContent className="space-y-4">
        <InlineSkeletonList rows={rows} />
      </CardContent>
    </Card>
  );
}

export function InlineSkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4 w-full">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* Banner Skeleton */}
      <Card className="bg-card border-border overflow-hidden relative">
        <CardContent className="p-6 sm:p-8">
          <Skeleton className="h-8 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>

      {/* Stats Skeleton */}
      <StatCardsSkeleton count={3} />

      {/* Charts/Lists Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
