"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { formatLastCompletedAtElapsed } from "@/lib/formatElapsedSince";
import {
  formatSyncEtaMinutes,
  formatSyncProgresoConEta,
} from "@/lib/formatSyncEta";
import DuxSyncStyleButton from "@/components/shared/DuxSyncStyleButton";
import type { Rol } from "@/lib/permisos";

const POLL_INTERVAL_MS = 1500;
const SYNC_LABEL = "SINCRONIZAR";

interface Props {
  rol: Rol;
}

export default function SyncStatusIndicator({ rol: _rol }: Props) {
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | null>(null);
  const [requestingStart, setRequestingStart] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRunningRef = useRef(false);
  const prevLastCompletedAtRef = useRef<string | null>(null);
  const syncStepsRunningRef = useRef(false);

  const syncEnCurso = running || requestingStart;

  async function runSyncStepsUntilDone() {
    if (syncStepsRunningRef.current) return;
    syncStepsRunningRef.current = true;
    try {
      let continuing = true;
      let fallosRed = 0;
      while (continuing) {
        try {
          const res = await fetch("/api/sync-lista-precios-tienda", { method: "POST" });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.ok) {
            if (data?.cancelled) break;
            if (data?.error) {
              toast.error(String(data.error));
              break;
            }
            fallosRed += 1;
            if (fallosRed >= 3) {
              toast.error("Error de red durante la sincronización.");
              break;
            }
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          fallosRed = 0;
          continuing = !!data.continuing;
        } catch {
          fallosRed += 1;
          if (fallosRed >= 3) {
            toast.error("Error de red durante la sincronización.");
            break;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } catch {
      toast.error("Error de red durante la sincronización.");
    } finally {
      syncStepsRunningRef.current = false;
    }
  }

  useEffect(() => {
    function fetchStatus() {
      fetch("/api/sync-lista-precios-tienda/status")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;

          const nowRunning = !!data.running;
          const completedAt = data.lastCompletedAt ?? null;

          if (prevRunningRef.current && !nowRunning) {
            if (data.error) {
              toast.error(String(data.error));
            } else if (
              completedAt &&
              completedAt !== prevLastCompletedAtRef.current
            ) {
              const proc = Number(data.processed ?? 0);
              const tot = Number(data.total ?? 0);
              if (tot > 0 && proc < tot) {
                toast.error(
                  `Sincronización incompleta: ${proc.toLocaleString("es-AR")} de ${tot.toLocaleString("es-AR")} productos. Volvé a sincronizar.`
                );
              } else {
                toast.success(
                  tot > 0
                    ? `Sincronización de productos finalizada: ${proc.toLocaleString("es-AR")} de ${tot.toLocaleString("es-AR")}.`
                    : "Sincronización de productos finalizada."
                );
              }
            }
          }

          prevRunningRef.current = nowRunning;
          if (completedAt != null) {
            prevLastCompletedAtRef.current = completedAt;
          }

          setRunning(nowRunning);
          setProcessed(data.processed ?? 0);
          setTotal(data.total ?? 0);
          setRemainingMinutes(data.remainingMinutes ?? 0);
          setLastCompletedAt(completedAt);
        })
        .catch(() => {});
    }

    fetchStatus();
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!running || requestingStart || syncStepsRunningRef.current) return;
    void runSyncStepsUntilDone();
  }, [running, requestingStart]);

  async function iniciarSyncProductos() {
    if (syncEnCurso) return;
    setRequestingStart(true);
    try {
      await runSyncStepsUntilDone();
    } finally {
      setRequestingStart(false);
    }
  }

  const ultimaActLabel = formatLastCompletedAtElapsed(lastCompletedAt) ?? "—";

  const progreso = useMemo(() => {
    if (!syncEnCurso) return undefined;

    const detalle =
      total > 0 || processed > 0
        ? formatSyncProgresoConEta(processed, total, remainingMinutes)
        : remainingMinutes > 0
          ? `${formatSyncEtaMinutes(remainingMinutes)} restantes`
          : "Iniciando…";
    return { mensaje: "SINCRONIZANDO…", detalle };
  }, [syncEnCurso, processed, total, remainingMinutes]);

  return (
    <DuxSyncStyleButton
      lineIdle={SYNC_LABEL}
      lineHover={SYNC_LABEL}
      secondary={`Últ. Act.: ${ultimaActLabel}`}
      aria-label="Sincronizar datos desde DUX"
      onClick={() => void iniciarSyncProductos()}
      disabled={syncEnCurso}
      busy={syncEnCurso}
      surface="sidebar"
      progreso={progreso}
    />
  );
}
