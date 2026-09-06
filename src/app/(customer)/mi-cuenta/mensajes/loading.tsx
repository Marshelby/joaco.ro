import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerMessagesLoading() {
  return <div aria-busy="true" aria-label="Cargando mensajes" className="space-y-6"><header className="space-y-3 border-b border-border pb-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-5 w-72 max-w-full" /></header><section className="overflow-hidden rounded-xl border border-border bg-card"><div className="space-y-2 border-b border-border p-5"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-72 max-w-full" /></div><div className="h-96 space-y-4 p-5"><Skeleton className="h-16 w-3/4 rounded-2xl" /><Skeleton className="ml-auto h-20 w-2/3 rounded-2xl" /><Skeleton className="h-14 w-1/2 rounded-2xl" /></div><div className="border-t border-border p-4"><Skeleton className="h-20 w-full rounded-lg" /></div></section></div>;
}
