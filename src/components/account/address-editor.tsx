"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";

import { CustomerAddressForm, type DireccionClienteFormulario, type ZonaEntregaFormulario } from "@/components/account/customer-address-form";
import { actionLinkVariants } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { hrefConReturnTo, type ReturnToCompra } from "@/lib/account/return-to";

const OpenAddressEditor = createContext<(trigger: HTMLButtonElement, direccion?: DireccionClienteFormulario) => void>(() => {});

export function AddressEditorTrigger({ children, className, direccion, variant }: {
  children: ReactNode;
  className?: string;
  direccion?: DireccionClienteFormulario;
  variant?: "secondary";
}) {
  const openEditor = useContext(OpenAddressEditor);

  return (
    <button type="button" aria-haspopup="dialog" className={actionLinkVariants({ variant, className })} onClick={(event) => openEditor(event.currentTarget, direccion)}>
      {children}
    </button>
  );
}

export function AddressEditor({ children, zonas, errorZonas, returnTo, initialOpen, initialAddress }: {
  children: ReactNode;
  zonas: readonly ZonaEntregaFormulario[];
  errorZonas: boolean;
  returnTo: ReturnToCompra | null;
  initialOpen: boolean;
  initialAddress?: DireccionClienteFormulario;
}) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [editor, setEditor] = useState<{ direccion?: DireccionClienteFormulario } | null>(
    () => initialOpen ? { direccion: initialAddress } : null,
  );

  function close() {
    setEditor(null);
    if (initialOpen) router.replace(hrefConReturnTo(ROUTES.accountAddresses, returnTo), { scroll: false });
  }

  return (
    <OpenAddressEditor.Provider value={(button, direccion) => {
      trigger.current = button;
      setEditor({ direccion });
    }}>
      {children}
      {editor && (
        <CustomerAddressForm
          direccion={editor.direccion}
          zonas={zonas}
          errorZonas={errorZonas}
          trigger={trigger}
          onClose={close}
        />
      )}
    </OpenAddressEditor.Provider>
  );
}
