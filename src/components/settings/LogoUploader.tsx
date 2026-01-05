import { useState, useRef } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageCropperModal } from "@/components/shared/ImageCropperModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LogoUploaderProps {
  logoUrl: string | null;
  barbershopId: string;
  barbershopName: string;
  onLogoChange: (url: string) => void;
  autoSave?: boolean;
}

export function LogoUploader({ logoUrl, barbershopId, barbershopName, onLogoChange, autoSave = true }: LogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // No size limit - cropper will compress to ≤1MB
    const objectUrl = URL.createObjectURL(file);
    setImageToCrop(objectUrl);
    setCropperOpen(true);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    // Image is already compressed by the cropper to ≤1MB
    setIsUploading(true);

    try {
      const fileName = `${barbershopId}/logo.jpg`;
      const file = new File([croppedBlob], "logo.jpg", { type: "image/jpeg" });

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("barbershop-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("barbershop-logos")
        .getPublicUrl(fileName);

      // Auto-save logo_url to barbershops table
      if (autoSave) {
        const { error: saveError } = await supabase
          .from("barbershops")
          .update({ logo_url: publicUrl })
          .eq("id", barbershopId);

        if (saveError) {
          console.error("Error saving logo URL:", saveError);
        }
      }

      // Add cache buster to force refresh
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      onLogoChange(urlWithCacheBuster);
      toast.success("Logo atualizado com sucesso");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setIsUploading(true);
    try {
      if (autoSave) {
        const { error } = await supabase
          .from("barbershops")
          .update({ logo_url: null })
          .eq("id", barbershopId);

        if (error) throw error;
      }

      onLogoChange("");
      toast.success("Logo removido com sucesso");
    } catch (error) {
      console.error("Error removing logo:", error);
      toast.error("Erro ao remover logo");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className="relative w-24 h-24 rounded-2xl overflow-hidden cursor-pointer group border-2 border-dashed border-border hover:border-primary transition-colors"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={barbershopName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-3xl font-bold text-muted-foreground">
                {barbershopName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {isUploading ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
          </div>
        </div>

        {/* Remove button */}
        {logoUrl && !isUploading && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="absolute -top-1 -right-1 w-5 h-5 bg-muted text-muted-foreground rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-colors shadow-sm border border-border"
                title="Remover logo"
              >
                <X className="w-3 h-3" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover logo da empresa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O logo será removido permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveLogo}>
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <p className="text-xs text-muted-foreground text-center">
        Clique para alterar o logo
      </p>

      {imageToCrop && (
        <ImageCropperModal
          open={cropperOpen}
          onClose={() => {
            setCropperOpen(false);
            setImageToCrop(null);
          }}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          title="Recortar Logo"
        />
      )}
    </div>
  );
}
