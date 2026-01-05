import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageCropperModal } from "@/components/shared/ImageCropperModal";

interface LogoUploaderProps {
  logoUrl: string | null;
  barbershopId: string;
  barbershopName: string;
  onLogoChange: (url: string) => void;
}

export function LogoUploader({ logoUrl, barbershopId, barbershopName, onLogoChange }: LogoUploaderProps) {
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

  return (
    <div className="flex flex-col items-center gap-3">
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
