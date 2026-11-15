import type { ReactNode } from "react";
import { OrderDetailModal } from "@/components/admin/order-detail-modal";

export default function ModalLayout({ children }: { children: ReactNode }) {
  return <OrderDetailModal>{children}</OrderDetailModal>;
}
