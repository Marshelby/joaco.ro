import { Skeleton } from "@/components/ui/skeleton";

export default function AdminMessagesLoading() {
  return <div aria-busy="true" aria-label="Cargando mensajes" className="space-y-6"><header className="space-y-3 border-b border-border pb-6"><Skeleton className="h-9 w-44" /><Skeleton className="h-5 w-80 max-w-full" /></header><section className="grid min-h-96 overflow-hidden rounded-xl border border-border lg:grid-cols-[22rem_1fr]"><div className="space-y-4 border-r border-border p-4">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20 w-full rounded-lg" />)}</div><div className="hidden p-5 lg:block"><Skeleton className="h-full w-full rounded-xl" /></div></section></div>;
}
