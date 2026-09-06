"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { crearClienteSupabaseNavegador } from "@/lib/supabase/client";

export function AdminInboxRealtime({ children }: { children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = crearClienteSupabaseNavegador();
    const canal = supabase
      .channel("inbox-admin-mensajes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_conversacion" }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [router]);
  return <>{children}</>;
}
