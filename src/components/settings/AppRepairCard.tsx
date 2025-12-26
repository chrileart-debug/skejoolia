import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AppRepairCard() {
  const [isWorking, setIsWorking] = useState(false);

  const handleRepair = useCallback(async () => {
    setIsWorking(true);

    try {
      // Unregister service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }

      // Clear CacheStorage
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      toast.success("Cache limpo. Recarregando...");
      window.location.reload();
    } catch (e) {
      console.error("[AppRepair] Failed to clear caches", e);
      toast.error("Não foi possível limpar o cache automaticamente.");
      setIsWorking(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reparar carregamento</CardTitle>
        <CardDescription>
          Se o Pixel só aparece após Ctrl+Shift+R, use isso para limpar cache e Service Worker.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="w-full" onClick={handleRepair} disabled={isWorking}>
          {isWorking ? "Limpando cache..." : "Reparar cache do app"}
        </Button>
      </CardContent>
    </Card>
  );
}
