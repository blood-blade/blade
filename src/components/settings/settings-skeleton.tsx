import { Skeleton } from '@/components/ui/skeleton';

export function SettingsSkeleton() {
    return (
        <div className="p-2 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-card/50">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-6 w-6 rounded-md" />
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    </div>
                    <Skeleton className="h-5 w-5 rounded-md" />
                </div>
            ))}
        </div>
    );
}