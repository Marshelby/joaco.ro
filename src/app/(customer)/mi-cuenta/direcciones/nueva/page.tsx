import type { Metadata } from "next";

import { CustomerAddresses } from "@/components/account/customer-addresses";
import { obtenerReturnToSeguro } from "@/lib/account/return-to";

export const metadata: Metadata = { title: "Nueva dirección" };

export default async function Page({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return <CustomerAddresses returnTo={obtenerReturnToSeguro(returnTo)} initialEditor={null} />;
}
