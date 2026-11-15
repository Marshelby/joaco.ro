"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/ui/action-link";

export const OrderCustomerNavigation = createContext<{
  messagesOpen: boolean;
  setMessagesOpen: (open: boolean) => void;
  customerOpen: boolean;
  customerAnchor: string;
  setCustomerAnchor: (anchor: string) => void;
  setCustomerOpen: (open: boolean) => void;
} | null>(null);

// Server-rendered details stay mounted so returning preserves forms and disclosure state.
export function OrderCustomerViews({ children, customer, messages }: { children: ReactNode; customer: ReactNode; messages: ReactNode }) {
  const navigation = useContext(OrderCustomerNavigation);
  const root = useRef<HTMLDivElement>(null);
  const customerScroll = useRef(0);
  const customerFocus = useRef<HTMLElement | null>(null);
  const [messagesVisited, setMessagesVisited] = useState(false);
  const messagesOpen = navigation?.messagesOpen ?? false;
  if (messagesOpen && !messagesVisited) setMessagesVisited(true);
  const orderScroll = useRef(0);
  const orderFocus = useRef<HTMLElement | null>(null);
  const customerOpen = navigation?.customerOpen ?? false;

  useLayoutEffect(() => {
    const scroller = root.current?.closest<HTMLElement>("[data-order-modal-scroll]");
    if (!scroller) return;
    if (messagesOpen) {
      scroller.scrollTop = 0;
      root.current?.querySelector<HTMLElement>("[data-messages-view]")?.focus({ preventScroll: true });
    } else if (customerOpen) {
      scroller.scrollTop = customerScroll.current;
      if (customerFocus.current?.isConnected) customerFocus.current.focus({ preventScroll: true });
      else root.current?.querySelector<HTMLElement>("[data-customer-view]")?.focus({ preventScroll: true });
      if (!customerFocus.current && navigation?.customerAnchor) {
        const target = root.current?.querySelector<HTMLElement>("[data-customer-view]")?.querySelector<HTMLElement>(`[id="${navigation.customerAnchor}"]`);
        if (target) scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      }
    } else {
      scroller.scrollTop = orderScroll.current;
      if (orderFocus.current?.isConnected) orderFocus.current.focus({ preventScroll: true });
    }
  }, [customerOpen, messagesOpen, navigation?.customerAnchor]);

  return <div ref={root} onClickCapture={(event) => {
    if (messagesOpen) return;
    if (customerOpen) {
      customerScroll.current = root.current?.closest<HTMLElement>("[data-order-modal-scroll]")?.scrollTop ?? 0;
      customerFocus.current = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("a,button") : null;
      return;
    }
    orderScroll.current = root.current?.closest<HTMLElement>("[data-order-modal-scroll]")?.scrollTop ?? 0;
    orderFocus.current = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("a,button") : null;
  }}>
    <div hidden={customerOpen}>{children}</div>
    <div hidden={!customerOpen || messagesOpen} data-customer-view tabIndex={-1} className="outline-none">{customer}</div>
    <div hidden={!messagesOpen} data-messages-view tabIndex={-1} className="outline-none">{messagesVisited ? messages : null}</div>
  </div>;
}

export function OrderCustomerLink(props: ComponentProps<typeof ActionLink>) {
  const navigation = useContext(OrderCustomerNavigation);
  return <ActionLink {...props} onNavigate={(event) => {
    if (!navigation) return;
    event.preventDefault();
    const href = typeof props.href === "string" ? props.href : "";
    navigation.setCustomerAnchor(href.includes("#cuenta-corriente-title") ? "cuenta-corriente-title" : "");
    navigation.setCustomerOpen(true);
  }} />;
}

// A history link still uses the existing order route, but starts in order view.
export function CustomerOrderLink(props: ComponentProps<typeof ActionLink>) {
  const navigation = useContext(OrderCustomerNavigation);
  return <ActionLink {...props} onNavigate={() => navigation?.setCustomerOpen(false)} />;
}

export function OrderCustomerMessagesLink() {
  const navigation = useContext(OrderCustomerNavigation);
  return <Button type="button" onClick={() => navigation?.setMessagesOpen(true)}>Enviar mensaje</Button>;
}
