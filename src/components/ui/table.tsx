"use client"

import * as React from "react"

import {
  tableEmptyStateContainerVariants,
  tableEmptyStateMessageVariants,
} from "@/components/shared/TableEmptyState"
import { cn } from "@/lib/utils"

type TableVariant = "default" | "compact"

interface TableProps extends React.ComponentProps<"table"> {
  variant?: TableVariant
  /**
   * Compatibilidad / flex: `false` añade `min-w-0 max-w-full` para tablas dentro de layouts estrechos.
   * El scroll vertical u horizontal **no** va en este wrapper: debe estar en el padre (p. ej. `.contenedor-tabla-gestion`
   * o un `div` con `overflow-y-auto`); si no, `position: sticky` del encabezado queda anclado a un scrollport
   * intermedio y el `<thead>` se va con el scroll.
   */
  scrollX?: boolean
}

/** Diseño único de tablas (referencia: Comp. Proveedores). Aplica .tabla-gestion-compacta (globals.css).
 * Encabezado fijo: `TableHeader` / `TableHead` + `globals.css`; el scroll lo define el ancestro, no `data-slot="table-container"`. */
function Table({ className, variant: _variant, scrollX = true, ...props }: TableProps) {
  const tableClass = cn("tabla-gestion-compacta", className)
  return (
    <div
      data-slot="table-container"
      className={cn("relative min-h-0 w-full", scrollX === false && "min-w-0 max-w-full")}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", tableClass)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "sticky top-0 z-20 bg-primary [&_tr]:border-0 [&_tr]:bg-transparent [&_tr:hover]:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-b-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
        className={cn(
        "bg-sidebar text-sidebar-foreground border-t border-sidebar-border font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border transition-[background-color] duration-150",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  const { children, ...rest } = props
  return (
    <th
      data-slot="table-head"
      className={cn(
        "sticky top-0 z-20 text-primary-foreground text-xs font-bold leading-none text-center align-middle uppercase",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...rest}
    >
      <span className="table-head-inner">
        <span className="table-head-label">{children}</span>
      </span>
    </th>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "text-foreground text-xs font-normal leading-tight text-center align-middle whitespace-nowrap",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

/** Fila vacía reutilizable: tabla visible sin datos (ej. sin filtros o sin resultados). */
function EmptyTableRow({
  colSpan,
  message,
  className,
}: {
  colSpan: number;
  message: string;
  className?: string;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className={cn(
          tableEmptyStateContainerVariants({
            placement: "tableCell",
            textSize: "sm",
          }),
          className
        )}
      >
        <span className={tableEmptyStateMessageVariants({ maxWidth: "readable" })}>
          {message}
        </span>
      </TableCell>
    </TableRow>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  EmptyTableRow,
}
