"use client";

import { useEffect, useRef } from "react";
import type { ItemStock } from "@/actions/stock";
import { fmtCantidad } from "@/lib/format";
import { formatFechaHoraCompletaArgentina } from "@/lib/fechaArgentina";

interface Props {
  items:    ItemStock[];
  sucursal: string;
  onClose:  () => void;
}

export default function PrintStock({ items, sucursal, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fecha = formatFechaHoraCompletaArgentina(new Date());

    const filas = items.map((item) => {
      const stock = fmtCantidad(item.stock);
      return `
        <tr>
          <td class="cod">${item.codItem}</td>
          <td class="desc">${item.descripcion}</td>
          <td class="cant">${stock}</td>
        </tr>
      `;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Stock ${sucursal}</title>
  <style>
    @page { size: A4; margin: 15mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; }

    /* Token alineado con globals.css :root --primary (SSOT) */
    :root { --primary: #0072BB; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px; border-bottom: 2px solid var(--primary); padding-bottom: 6px; }
    .header h1 { font-size: 16pt; font-weight: 900; color: var(--primary); text-transform: uppercase; letter-spacing: 2px; }
    .header .meta { text-align: right; font-size: 8pt; color: #555; line-height: 1.5; }
    .header .meta strong { color: #111; }
    .header-sucursal { font-size:10pt; font-weight:700; color:#333; margin-top:2px; }

    table { width: 100%; border-collapse: collapse; }
    thead tr { background: var(--primary); color: #fff; }
    thead th { padding: 5px 6px; text-align: left; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    thead th.cant { text-align: right; width: 60px; }
    thead th.cod  { width: 80px; }

    tbody tr:nth-child(even) { background: #f4f8fc; }
    tbody td { padding: 3.5px 6px; border-bottom: 1px solid #e0e8f0; font-size: 8.5pt; }
    td.cod  { width: 80px; font-family: monospace; color: #555; font-size: 8pt; }
    td.desc { }
    td.cant { text-align: right; font-weight: 600; width: 60px; }

    .footer { margin-top: 10px; font-size: 7.5pt; color: #888; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Control de Stock</h1>
      <div class="header-sucursal">Sucursal: ${sucursal}</div>
    </div>
    <div class="meta">
      <div><strong>Fecha:</strong> ${fecha}</div>
      <div><strong>Total ítems:</strong> ${items.length.toLocaleString("es-AR")}</div>
    </div>
  </div>

  <table class="tabla-gestion-compacta">
    <thead>
      <tr>
        <th class="cod">Código</th>
        <th>Descripción</th>
        <th class="cant">Stock</th>
      </tr>
    </thead>
    <tbody>
      ${filas}
    </tbody>
  </table>

  <div class="footer">TiendaColor — Impreso el ${fecha}</div>
</body>
</html>`;

    const ventana = window.open("", "_blank", "width=900,height=700");
    if (!ventana) { onClose(); return; }

    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    ventana.onload = () => {
      ventana.print();
      ventana.onafterprint = () => { ventana.close(); onClose(); };
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} />;
}
