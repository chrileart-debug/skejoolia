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

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
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

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 1MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    if (!serviceId) {
      onImageUploaded(objectUrl);
      return;
    }

    await uploadFile(file, serviceId);
  };

  const uploadFile = async (file: File, targetServiceId: string) => {
    setIsUploading(true);

    try {
      const extension = getFileExtension(file);
      const filePath = `${userId}/servicos/${targetServiceId}.${extension}`;

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

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("services")
        .update({ image_url: publicUrl })
        .eq("id", targetServiceId);

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

      await supabase
        .from("services")
        .update({ image_url: null })
        .eq("id", serviceId);

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
          relative aspect-square w-32 border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all
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
        JPG, PNG ou WEBP (máx. 1MB)
      </p>
    </div>
  );
}

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
