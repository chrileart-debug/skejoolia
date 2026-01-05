import { useState, useRef } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

interface ServiceImageUploadProps {
  serviceId?: string;
  userId: string;
  currentImage: string | null;
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
}
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
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileExtension = (file: File): string => {
    const name = file.name;
    const lastDot = name.lastIndexOf(".");
    return lastDot !== -1 ? name.substring(lastDot + 1).toLowerCase() : "jpg";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }

    // Open cropper with the selected image (no size limit - will compress after crop)
    const objectUrl = URL.createObjectURL(file);
    setImageToCrop(objectUrl);
    setCropperOpen(true);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    // Image is already compressed by the cropper to ≤1MB
    const objectUrl = URL.createObjectURL(croppedBlob);
    setPreviewUrl(objectUrl);

    if (!serviceId) {
      // For new services, just set preview
      onImageUploaded(objectUrl);
      return;
    }

    // Upload cropped image
    const file = new File([croppedBlob], `service-${serviceId}.jpg`, { type: "image/jpeg" });
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

      <div className="relative">
        <div
          onClick={handleClick}
          className={`
            relative w-20 h-20 border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all group
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
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium">Alterar</span>
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

        {previewUrl && !isUploading && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="absolute -top-1 -right-1 w-5 h-5 bg-muted text-muted-foreground rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-colors shadow-sm border border-border"
                title="Remover imagem"
              >
                <X className="w-3 h-3" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover imagem do serviço?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A imagem será removida permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveImage}>
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        JPG, PNG ou WEBP
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
          title="Recortar Imagem do Serviço"
        />
      )}
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