import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md mx-auto space-y-4 p-6">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-6 rounded-lg border bg-card">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-8 w-1/2 mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}