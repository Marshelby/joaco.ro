import type { Metadata } from "next";

import { CustomerAddresses } from "@/components/account/customer-addresses";
import { obtenerReturnToSeguro } from "@/lib/account/return-to";

export const metadata: Metadata = { title: "Editar dirección" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  return <CustomerAddresses returnTo={obtenerReturnToSeguro(returnTo)} initialEditor={id} />;
}
