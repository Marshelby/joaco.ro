type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Cargando contenido" }: LoadingStateProps) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-card p-5" role="status" aria-live="polite" aria-atomic="true">
      <span className="size-4 animate-pulse rounded-full bg-muted-foreground/50 motion-reduce:animate-none" aria-hidden="true" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
