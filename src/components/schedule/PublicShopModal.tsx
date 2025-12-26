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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Store className="w-5 h-5 text-primary" />
            Minha Loja Pública
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-3">
          {/* Slug Input */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Link personalizado</Label>
            <div className="flex items-center rounded-xl border border-input bg-muted/30 overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all">
              <span className="px-3 py-2.5 text-sm text-muted-foreground bg-muted/50 border-r border-input font-mono">
                /a/
              </span>
              <Input
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="minha-barbearia"
                className="border-0 bg-transparent focus-visible:ring-0 font-mono text-sm"
              />
            </div>
            {slugError && (
              <p className="text-sm text-destructive">{slugError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use letras minúsculas, números e hífens
            </p>
          </div>

          {/* URL Preview - Copyable Card */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Prévia do link</Label>
            <button
              onClick={copyToClipboard}
              disabled={!slug}
              className={cn(
                "w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all text-left",
                slug 
                  ? "bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/50 cursor-pointer" 
                  : "bg-muted/20 border-border/50 cursor-not-allowed opacity-60"
              )}
            >
              <span className="text-sm text-foreground truncate font-mono">
                {fullUrl}
              </span>
              <div className={cn(
                "flex-shrink-0 p-1.5 rounded-lg transition-colors",
                copied ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
              )}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </div>
            </button>
            <p className="text-xs text-muted-foreground">
              Clique para copiar o link
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            className="w-full h-11"
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
