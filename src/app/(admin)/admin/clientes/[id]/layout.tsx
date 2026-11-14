import type { ReactNode } from "react";

export default function CustomerDetailLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return <>{children}{modal}</>;
}
