"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export function TurnstileCaptcha({ onTokenChange, resetSignal = 0 }: { onTokenChange: (token: string) => void; resetSignal?: number }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (window.turnstile) setScriptReady(true);
  }, []);

  useEffect(() => {
    if (!siteKey || !scriptReady || !window.turnstile || !containerRef.current || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "auto",
      size: "flexible",
      callback: (token: string) => { setError(false); onTokenChange(token); },
      "expired-callback": () => { onTokenChange(""); setError(true); },
      "error-callback": () => { onTokenChange(""); setError(true); },
    });
  }, [onTokenChange, scriptReady, siteKey]);

  useEffect(() => {
    if (!resetSignal || !widgetIdRef.current || !window.turnstile) return;
    onTokenChange("");
    setError(false);
    window.turnstile.reset(widgetIdRef.current);
  }, [onTokenChange, resetSignal]);

  if (!siteKey) return null;

  return <div className="space-y-2"><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => setScriptReady(true)} onError={() => { onTokenChange(""); setError(true); }} /><div ref={containerRef} aria-label="Verificación de acceso" />{error ? <p role="alert" className="text-sm text-destructive">No pudimos verificar el acceso. Intenta nuevamente.</p> : null}</div>;
}
