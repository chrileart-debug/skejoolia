import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PublicShopModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbershopId: string | null;
  currentSlug: string;
  onSlugSaved: (slug: string) => void;
}

export function PublicShopModal({
  open,
  onOpenChange,
  barbershopId,
  currentSlug,
  onSlugSaved,
}: PublicShopModalProps) {
  const [slug, setSlug] = useState(currentSlug);
  const [slugError, setSlugError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSlug(currentSlug);
    setSlugError("");
  }, [currentSlug, open]);

  const handleSlugChange = (value: string) => {
    const formatted = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(formatted);
    setSlugError("");
  };

  const fullUrl = `${window.location.origin}/a/${slug || "sua-loja"}`;

  const copyToClipboard = () => {
    if (!slug) return;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!barbershopId || !slug.trim()) {
      toast.error("Informe um identificador válido");
      return;
    }

    setIsLoading(true);
    setSlugError("");

    // Check slug uniqueness
    const { data: existingSlug } = await supabase
      .from("barbershops")
      .select("id")
      .eq("slug", slug)
      .neq("id", barbershopId)
      .maybeSingle();

    if (existingSlug) {
      setSlugError("Este link já está em uso. Escolha outro.");
      toast.error("Este link já está em uso");
      setIsLoading(false);
      return;
    }

    const { error } = await supabase
      .from("barbershops")
      .update({ slug })
      .eq("id", barbershopId);

    if (error) {
      console.error("Error updating slug:", error);
      toast.error("Erro ao salvar");
      setIsLoading(false);
      return;
    }

    toast.success("Link publicado com sucesso!");
    onSlugSaved(slug);
    setIsLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Minha Loja Pública
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Link personalizado</Label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">
                /a/
              </span>
              <Input
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="minha-barbearia"
                className="rounded-l-none"
              />
            </div>
            {slugError && (
              <p className="text-sm text-destructive">{slugError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use letras minúsculas, números e hífens
            </p>
          </div>

          <div className="space-y-2">
            <Label>Prévia do link</Label>
            <div
              onClick={copyToClipboard}
              className={cn(
                "flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors",
                slug ? "bg-muted hover:bg-muted/80" : "bg-muted/50 cursor-not-allowed"
              )}
            >
              <span className="text-sm truncate">{fullUrl}</span>
              <div className="ml-2 flex-shrink-0">
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
            {slug && (
              <p className="text-xs text-muted-foreground">
                Clique para copiar
              </p>
            )}
          </div>

          <Button
            onClick={handleSave}
            className="w-full"
            disabled={isLoading || !slug.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Publicar Link"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
