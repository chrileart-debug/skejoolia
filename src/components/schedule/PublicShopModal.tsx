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
import { Copy, Check, ExternalLink, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

  const copyPublicLink = () => {
    const link = `${window.location.origin}/a/${slug}`;
    navigator.clipboard.writeText(link);
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

    toast.success("Loja pública ativada!");
    onSlugSaved(slug);
    setIsLoading(false);
    onOpenChange(false);
  };

  const fullUrl = `${window.location.origin}/a/${slug || "sua-loja"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Configurar Minha Loja Pública
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Slug Input */}
          <div className="space-y-2">
            <Label>Slug (identificador único)</Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center rounded-md border border-input bg-background overflow-hidden">
                <span className="px-3 py-2 text-sm text-muted-foreground bg-muted border-r whitespace-nowrap">
                  /a/
                </span>
                <Input
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="minha-barbearia"
                  className="border-0 rounded-none focus-visible:ring-0"
                />
              </div>
              {slug && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyPublicLink}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              )}
            </div>
            {slugError && (
              <p className="text-sm text-destructive">{slugError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use apenas letras minúsculas, números e hífens
            </p>
          </div>

          {/* Live URL Preview */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate">
              {fullUrl}
            </span>
          </div>

          {/* Save Button */}
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
              <>
                <Store className="w-4 h-4 mr-2" />
                Salvar e Ativar Loja
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
