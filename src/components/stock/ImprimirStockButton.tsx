"use client";

import { Printer } from "lucide-react";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import type { TablaStockHandle } from "./TablaStock";

interface Props {
  tableRef: React.RefObject<TablaStockHandle | null>;
  disabled?: boolean;
}

export default function ImprimirStockButton({ tableRef, disabled }: Props) {
  return (
    <ToolbarActionButton
      label="Imprimir"
      icon={<Printer />}
      disabled={disabled}
      onClick={() => tableRef.current?.openPrint()}
    />
  );
}
