import { useState, useRef } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ServiceImageUploadProps {
  serviceId?: string;
  userId: string;
  currentImage: string | null;
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function ServiceImageUpload({
  serviceId,
  userId,
  currentImage,
  onImageUploaded,
  onImageRemoved,
}: ServiceImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileExtension = (file: File): string => {
    const name = file.name;
    const lastDot = name.lastIndexOf(".");
    return lastDot !== -1 ? name.substring(lastDot + 1).toLowerCase() : "jpg";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 50MB.");
      return;
    }

    // Create preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // If no serviceId yet (creating new service), just show preview
    // The actual upload will happen after service creation
    if (!serviceId) {
      // Store file in a temporary way - we'll upload after service creation
      onImageUploaded(objectUrl);
      return;
    }

    // Upload the file
    await uploadFile(file, serviceId);
  };

  const uploadFile = async (file: File, targetServiceId: string) => {
    setIsUploading(true);

    try {
      const extension = getFileExtension(file);
      const filePath = `${userId}/servicos/${targetServiceId}.${extension}`;

      // Delete existing image first (if any)
      const { data: existingFiles } = await supabase.storage
        .from("midia-imagens-cortes")
        .list(`${userId}/servicos`, {
          search: targetServiceId,
        });

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles
          .filter((f) => f.name.startsWith(targetServiceId))
          .map((f) => `${userId}/servicos/${f.name}`);

        if (filesToDelete.length > 0) {
          await supabase.storage
            .from("midia-imagens-cortes")
            .remove(filesToDelete);
        }
      }

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from("midia-imagens-cortes")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("midia-imagens-cortes")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update service in database
      const { error: updateError } = await supabase
        .from("cortes")
        .update({ image_corte: publicUrl })
        .eq("id_corte", targetServiceId);

      if (updateError) throw updateError;

      setPreviewUrl(publicUrl);
      onImageUploaded(publicUrl);
      toast.success("Imagem enviada com sucesso");
    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      toast.error("Erro ao enviar imagem. Tente novamente.");
      setPreviewUrl(currentImage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!serviceId || !previewUrl) {
      setPreviewUrl(null);
      onImageRemoved();
      return;
    }

    try {
      // List and delete files
      const { data: files } = await supabase.storage
        .from("midia-imagens-cortes")
        .list(`${userId}/servicos`, {
          search: serviceId,
        });

      if (files && files.length > 0) {
        const filesToDelete = files
          .filter((f) => f.name.startsWith(serviceId))
          .map((f) => `${userId}/servicos/${f.name}`);

        if (filesToDelete.length > 0) {
          await supabase.storage
            .from("midia-imagens-cortes")
            .remove(filesToDelete);
        }
      }

      // Update database
      await supabase
        .from("cortes")
        .update({ image_corte: null })
        .eq("id_corte", serviceId);

      setPreviewUrl(null);
      onImageRemoved();
      toast.success("Imagem removida");
    } catch (error) {
      console.error("Erro ao remover imagem:", error);
      toast.error("Erro ao remover imagem");
    }
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  // Expose upload function for external use (when creating new service)
  const uploadPendingImage = async (
    file: File,
    newServiceId: string
  ): Promise<string | null> => {
    try {
      const extension = getFileExtension(file);
      const filePath = `${userId}/servicos/${newServiceId}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("midia-imagens-cortes")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("midia-imagens-cortes")
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      return null;
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        onClick={handleClick}
        className={`
          relative h-32 border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all
          ${previewUrl ? "border-transparent" : "border-border hover:border-primary/50"}
          ${isUploading ? "pointer-events-none" : ""}
        `}
      >
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            {!isUploading && (
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick();
                  }}
                  className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                >
                  <Upload className="w-5 h-5 text-white" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage();
                  }}
                  className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              Clique para adicionar
            </span>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        JPG, PNG ou WEBP (máx. 50MB)
      </p>
    </div>
  );
}

// Export upload function for use in parent component
export async function uploadServiceImage(
  file: File,
  userId: string,
  serviceId: string
): Promise<string | null> {
  try {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${userId}/servicos/${serviceId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("midia-imagens-cortes")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("midia-imagens-cortes")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Erro ao enviar imagem:", error);
    return null;
  }
}
