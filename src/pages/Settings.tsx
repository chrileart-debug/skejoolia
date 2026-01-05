import { useState, useEffect, useRef } from "react";
import { useSetPageHeader } from "@/contexts/PageHeaderContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOutletContext } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Phone,
  Building2,
  Mail,
  MapPin,
  FileText,
  Save,
  LogOut,
  CheckCircle,
  Copy,
  Check,
  Loader2,
  Landmark,
  Calendar,
  Store,
  CreditCard,
  AlertCircle,
  X,
} from "lucide-react";
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

import { useBarbershop } from "@/hooks/useBarbershop";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LogoUploader } from "@/components/settings/LogoUploader";
import { formatPhoneMask } from "@/lib/phoneMask";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ImageCropperModal } from "@/components/shared/ImageCropperModal";

interface OutletContextType {
  onMenuClick: () => void;
}

export default function Settings() {
  useOutletContext<OutletContextType>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isOwner } = useBarbershop();
  
  useSetPageHeader("Configurações", "Gerencie sua conta");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSubmittingWebhook, setIsSubmittingWebhook] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [hasAsaasApiKey, setHasAsaasApiKey] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Profile photo upload
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  // User profile data (from user_settings)
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const [businessData, setBusinessData] = useState({
    company: "",
    publicPhone: "",
    logoUrl: "",
    niche: "",
    subNiche: "",
    cpfCnpj: "",
    birthDate: "",
    cep: "",
    address: "",
    addressNumber: "",
    bairro: "",
    city: "",
    state: "",
  });

  // Validation for mandatory company fields
  const mandatoryCompanyFields = [
    { key: "company", label: "Nome da Empresa" },
    { key: "cpfCnpj", label: "CPF/CNPJ" },
    { key: "birthDate", label: "Data de Nascimento" },
    { key: "publicPhone", label: "Telefone" },
    { key: "cep", label: "CEP" },
    { key: "address", label: "Logradouro" },
    { key: "addressNumber", label: "Número" },
    { key: "bairro", label: "Bairro" },
    { key: "city", label: "Cidade" },
    { key: "state", label: "Estado" },
  ];

  const validateCompanyData = (): boolean => {
    const errors: Record<string, string> = {};
    
    for (const field of mandatoryCompanyFields) {
      const value = businessData[field.key as keyof typeof businessData];
      if (!value || value.trim() === "") {
        errors[field.key] = `${field.label} é obrigatório`;
      }
    }

    // Additional CEP validation
    const cleanCep = businessData.cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      errors.cep = "CEP deve ter 8 dígitos";
    }

    // CPF/CNPJ length validation
    const cleanDoc = businessData.cpfCnpj.replace(/\D/g, "");
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      errors.cpfCnpj = "CPF deve ter 11 dígitos ou CNPJ 14 dígitos";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isCompanyFormValid = (): boolean => {
    for (const field of mandatoryCompanyFields) {
      const value = businessData[field.key as keyof typeof businessData];
      if (!value || value.trim() === "") {
        return false;
      }
    }
    const cleanCep = businessData.cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return false;
    
    const cleanDoc = businessData.cpfCnpj.replace(/\D/g, "");
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) return false;

    return true;
  };

  // Banking data for Asaas Transfer
  const [bankingData, setBankingData] = useState({
    operationType: "PIX" as "PIX" | "TED",
    pixKeyType: "" as "" | "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
    pixKey: "",
    bankCode: "",
    bankBranch: "",
    bankAccountNumber: "",
    bankAccountDigit: "",
  });

  // Determine if CPF or CNPJ
  const isCpf = (doc: string) => {
    const cleanDoc = doc.replace(/\D/g, "");
    return cleanDoc.length <= 11;
  };

  // Load user settings and barbershop data
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Listen for navigation event to switch to banking tab
  useEffect(() => {
    const handleNavigateTab = (event: CustomEvent<string>) => {
      if (event.detail === 'banking') {
        setActiveTab('banking');
      } else if (event.detail === 'company') {
        setActiveTab('company');
      }
    };

    window.addEventListener('navigate-settings-tab', handleNavigateTab as EventListener);
    return () => {
      window.removeEventListener('navigate-settings-tab', handleNavigateTab as EventListener);
    };
  }, []);

  const loadData = async () => {
    if (!user) return;
    
    try {
      // Load user profile from user_settings
      const { data: userSettings } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (userSettings) {
        setProfileData({
          name: userSettings.nome || "",
          phone: userSettings.numero || "",
          email: userSettings.email || user.email || "",
        });
        // Load avatar_url if present
        if ((userSettings as any).avatar_url) {
          setProfilePhotoUrl((userSettings as any).avatar_url);
        }
      } else {
        setProfileData(prev => ({ ...prev, email: user.email || "" }));
      }

      // Load business data from barbershops (via user_barbershop_roles)
      const { data: roleData } = await supabase
        .from("user_barbershop_roles")
        .select("barbershop_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData?.barbershop_id) {
        setBarbershopId(roleData.barbershop_id);
        
        const { data: barbershop } = await supabase
          .from("barbershops")
          .select("*")
          .eq("id", roleData.barbershop_id)
          .maybeSingle();

        if (barbershop) {
          setBusinessData({
            company: barbershop.name || "",
            publicPhone: barbershop.phone || "",
            logoUrl: barbershop.logo_url || "",
            niche: barbershop.nicho || "",
            subNiche: barbershop.subnicho || "",
            cpfCnpj: barbershop.cpf_cnpj || "",
            birthDate: (barbershop as any).bank_owner_birth_date || "",
            cep: barbershop.cep || "",
            address: barbershop.address || "",
            addressNumber: barbershop.address_number || "",
            bairro: barbershop.bairro || "",
            city: barbershop.city || "",
            state: barbershop.state || "",
          });

          // Check if asaas_api_key exists
          setHasAsaasApiKey(!!(barbershop as any).asaas_api_key);

          // Load banking data
          setBankingData({
            operationType: ((barbershop as any).bank_operation_type as "PIX" | "TED") || "PIX",
            pixKeyType: ((barbershop as any).bank_pix_key_type as "" | "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP") || "",
            pixKey: (barbershop as any).bank_pix_key || "",
            bankCode: (barbershop as any).bank_code || "",
            bankBranch: (barbershop as any).bank_branch || "",
            bankAccountNumber: (barbershop as any).bank_account_number || "",
            bankAccountDigit: (barbershop as any).bank_account_digit || "",
          });
        }
      }
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Handle profile photo selection - opens cropper
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }

    // No size limit - cropper will compress to ≤1MB
    const objectUrl = URL.createObjectURL(file);
    setImageToCrop(objectUrl);
    setCropperOpen(true);
  };

  // Handle cropped photo upload
  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user) return;

    // Image is already compressed by the cropper to ≤1MB
    setIsUploadingPhoto(true);
    try {
      const fileName = `${Date.now()}.jpg`;
      const filePath = `profiles/${user.id}/${fileName}`;
      const file = new File([croppedBlob], "profile.jpg", { type: "image/jpeg" });

      const { error: uploadError } = await supabase.storage
        .from("barbershop-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("barbershop-logos")
        .getPublicUrl(filePath);

      // Save avatar_url to user_settings to persist across refreshes
      const { error: saveError } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          avatar_url: publicUrl,
        });

      if (saveError) {
        console.error("Error saving avatar URL:", saveError);
      }

      // Add cache buster for display only
      setProfilePhotoUrl(`${publicUrl}?t=${Date.now()}`);
      toast.success("Foto atualizada!");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Erro ao enviar foto");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;
    
    setIsUploadingPhoto(true);
    try {
      // Clear avatar_url in user_settings
      const { error } = await supabase
        .from("user_settings")
        .update({ avatar_url: null })
        .eq("user_id", user.id);

      if (error) throw error;

      setProfilePhotoUrl(null);
      toast.success("Foto removida!");
    } catch (error) {
      console.error("Error removing photo:", error);
      toast.error("Erro ao remover foto");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);

    // Save user profile to user_settings
    const { error: userError } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        nome: profileData.name,
        numero: profileData.phone,
        email: profileData.email,
      });

    if (userError) {
      toast.error("Erro ao salvar perfil");
      setIsLoading(false);
      return;
    }

    toast.success("Perfil salvo com sucesso");
    setIsLoading(false);
  };

  const handleSaveCompany = async () => {
    if (!user || !barbershopId || !isOwner) return;
    
    // Validate all mandatory fields
    if (!validateCompanyData()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);

    // Save business data to database
    const { error: businessError } = await supabase
      .from("barbershops")
      .update({
        name: businessData.company,
        phone: businessData.publicPhone || null,
        logo_url: businessData.logoUrl || null,
        nicho: businessData.niche,
        subnicho: businessData.subNiche,
        cpf_cnpj: businessData.cpfCnpj,
        cep: businessData.cep,
        address: businessData.address,
        address_number: businessData.addressNumber,
        bairro: businessData.bairro,
        city: businessData.city,
        state: businessData.state,
        bank_owner_birth_date: businessData.birthDate || null,
      })
      .eq("id", barbershopId);

    if (businessError) {
      toast.error("Erro ao salvar dados da empresa");
      setIsLoading(false);
      return;
    }

    // If asaas_api_key is NULL, trigger webhook to create sub-account
    if (!hasAsaasApiKey) {
      setIsSubmittingWebhook(true);
      
      try {
        const webhookPayload = {
          barbershop_id: barbershopId,
          nome: businessData.company,
          email: profileData.email,
          cpf_cnpj: businessData.cpfCnpj.replace(/\D/g, ""),
          telefone: businessData.publicPhone.replace(/\D/g, ""),
          data_nascimento: businessData.birthDate,
          endereco: {
            cep: businessData.cep.replace(/\D/g, ""),
            logradouro: businessData.address,
            numero: businessData.addressNumber,
            bairro: businessData.bairro,
            cidade: businessData.city,
            estado: businessData.state,
          },
        };

        const response = await fetch("https://webhook.lernow.com/webhook/subconta-skjool", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(webhookPayload),
        });

        if (!response.ok) {
          throw new Error("Webhook request failed");
        }

        // Silent success - just show standard profile update message
        // Refresh data in background
        setTimeout(() => {
          loadData();
        }, 2000);
        
      } catch (error) {
        console.error("Webhook error:", error);
        // Silent failure - don't show banking-related errors
      } finally {
        setIsSubmittingWebhook(false);
      }
    }
    
    // Always show standard success message
    toast.success("Perfil atualizado com sucesso");

    setIsLoading(false);
  };

  const handleSaveBanking = async () => {
    if (!user || !barbershopId || !isOwner) return;
    setIsLoading(true);

    // Validate PIX fields if PIX selected
    if (bankingData.operationType === "PIX") {
      if (!bankingData.pixKeyType || !bankingData.pixKey) {
        toast.error("Preencha o tipo e a chave PIX");
        setIsLoading(false);
        return;
      }
    }

    // Validate TED fields if TED selected
    if (bankingData.operationType === "TED") {
      if (!bankingData.bankCode || !bankingData.bankBranch || !bankingData.bankAccountNumber) {
        toast.error("Preencha todos os dados bancários");
        setIsLoading(false);
        return;
      }
    }

    const { error } = await supabase
      .from("barbershops")
      .update({
        bank_operation_type: bankingData.operationType,
        bank_pix_key_type: bankingData.operationType === "PIX" ? bankingData.pixKeyType : null,
        bank_pix_key: bankingData.operationType === "PIX" ? bankingData.pixKey : null,
        bank_code: bankingData.operationType === "TED" ? bankingData.bankCode : null,
        bank_branch: bankingData.operationType === "TED" ? bankingData.bankBranch : null,
        bank_account_number: bankingData.operationType === "TED" ? bankingData.bankAccountNumber : null,
        bank_account_digit: bankingData.operationType === "TED" ? bankingData.bankAccountDigit : null,
      })
      .eq("id", barbershopId);

    if (error) {
      toast.error("Erro ao salvar dados bancários");
      setIsLoading(false);
      return;
    }

    toast.success("Dados bancários salvos com sucesso");
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Logout realizado");
    navigate("/");
  };

  const states = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  const pixKeyTypes = [
    { value: "CPF", label: "CPF" },
    { value: "CNPJ", label: "CNPJ" },
    { value: "EMAIL", label: "E-mail" },
    { value: "PHONE", label: "Telefone" },
    { value: "EVP", label: "Chave Aleatória" },
  ];

  return (
    <div className="min-h-screen">
      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
        {isInitialLoading ? (
          // Skeleton loader to prevent layout shift
          <div className="space-y-6">
            <div className="grid w-full grid-cols-2 h-10 bg-muted rounded-md animate-pulse" />
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
              <div className="h-4 w-60 bg-muted rounded animate-pulse" />
              <div className="space-y-4 mt-4">
                <div className="h-10 bg-muted rounded animate-pulse" />
                <div className="h-10 bg-muted rounded animate-pulse" />
                <div className="h-10 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-12 flex-1 bg-muted rounded animate-pulse" />
              <div className="h-12 flex-1 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ) : barbershopId ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={cn("grid w-full", isOwner ? "grid-cols-2" : "grid-cols-1")}>
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Perfil</span>
              </TabsTrigger>
              {isOwner && (
                <TabsTrigger value="company" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Empresa</span>
                </TabsTrigger>
              )}
              {/* Banking tab hidden - keeping code for future reactivation */}
              {false && isOwner && (
                <TabsTrigger value="banking" className="flex items-center gap-2">
                  <Landmark className="w-4 h-4" />
                  <span className="hidden sm:inline">Bancário</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Tab 1: Perfil - User data only */}
            <TabsContent value="profile" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Dados Pessoais
                  </CardTitle>
                  <CardDescription>
                    Informações do seu perfil de usuário
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Profile Photo - Square 1:1 */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <label className="relative cursor-pointer group block">
                        <Avatar className="w-20 h-20 rounded-xl">
                          <AvatarImage 
                            src={profilePhotoUrl || undefined} 
                            className="object-cover aspect-square"
                          />
                          <AvatarFallback className="w-20 h-20 rounded-xl gradient-primary text-2xl font-bold text-primary-foreground">
                            {profileData.name.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          {isUploadingPhoto ? (
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          ) : (
                            <span className="text-white text-xs">Alterar</span>
                          )}
                        </div>
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoSelect}
                          className="hidden"
                          disabled={isUploadingPhoto}
                        />
                      </label>
                      {profilePhotoUrl && !isUploadingPhoto && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              className="absolute -top-1 -right-1 w-5 h-5 bg-muted text-muted-foreground rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-colors shadow-sm border border-border"
                              title="Remover foto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover foto de perfil?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A foto será removida permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleRemovePhoto}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Foto de perfil (1:1)</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP. Máx 1MB</p>
                    </div>
                  </div>

                  {/* Image Cropper Modal for profile photo */}
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
                      title="Recortar Foto de Perfil"
                    />
                  )}

                  {/* Name */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Nome
                    </Label>
                    <Input
                      value={profileData.name}
                      onChange={(e) =>
                        setProfileData({ ...profileData, name: e.target.value })
                      }
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      WhatsApp
                    </Label>
                    <Input
                      value={profileData.phone}
                      onChange={(e) =>
                        setProfileData({ ...profileData, phone: formatPhoneMask(e.target.value) })
                      }
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  {/* Email - Read Only */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      E-mail
                      <span className="text-xs text-muted-foreground">(somente leitura)</span>
                    </Label>
                    <Input
                      value={profileData.email}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                    />
                  </div>
                </CardContent>
              </Card>


              {/* Actions for Profile tab */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  size="lg"
                  className="w-full sm:flex-1"
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isLoading ? "Salvando..." : "Salvar Perfil"}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair da conta
                </Button>
              </div>
            </TabsContent>

            {/* Tab 2: Empresa - Organized in visual groups */}
            <TabsContent value="company" className="space-y-6 mt-6">
              {/* Grupo 1: Identidade da Marca */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-primary" />
                    Identidade da Marca
                  </CardTitle>
                  <CardDescription>
                    Nome, logo e nicho do seu negócio
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Logo Upload - Square 1:1 */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <LogoUploader
                      logoUrl={businessData.logoUrl}
                      barbershopId={barbershopId}
                      barbershopName={businessData.company || "B"}
                      onLogoChange={(url) => setBusinessData({ ...businessData, logoUrl: url })}
                    />
                    <div className="flex-1 space-y-2 w-full">
                      {/* Company Name */}
                      <Label className="flex items-center gap-1">
                        Nome da Empresa
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={businessData.company}
                        onChange={(e) => {
                          setBusinessData({ ...businessData, company: e.target.value });
                          setValidationErrors(prev => ({ ...prev, company: "" }));
                        }}
                        placeholder="Nome da sua barbearia"
                        className={validationErrors.company ? "border-destructive" : ""}
                      />
                      {validationErrors.company && (
                        <p className="text-xs text-destructive">{validationErrors.company}</p>
                      )}
                    </div>
                  </div>

                  {/* Phone - Mandatory */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Telefone
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={businessData.publicPhone}
                      onChange={(e) => {
                        setBusinessData({ ...businessData, publicPhone: formatPhoneMask(e.target.value) });
                        setValidationErrors(prev => ({ ...prev, publicPhone: "" }));
                      }}
                      placeholder="(11) 99999-9999"
                      className={validationErrors.publicPhone ? "border-destructive" : ""}
                    />
                    {validationErrors.publicPhone && (
                      <p className="text-xs text-destructive">{validationErrors.publicPhone}</p>
                    )}
                  </div>

                  {/* Niche */}
                  <div className="space-y-2">
                    <Label>Nicho</Label>
                    <Input
                      value={businessData.niche}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, niche: e.target.value })
                      }
                      placeholder="Ex: Barbearia, Salão de Beleza..."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Grupo 2: Endereço Completo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Endereço Completo
                  </CardTitle>
                  <CardDescription>
                    Localização da sua empresa
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* CEP */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      CEP
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        value={businessData.cep}
                        onChange={async (e) => {
                          const cep = e.target.value.replace(/\D/g, "");
                          const formattedCep = cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5, 8)}` : cep;
                          setBusinessData({ ...businessData, cep: formattedCep });
                          setValidationErrors(prev => ({ ...prev, cep: "" }));
                          
                          if (cep.length === 8) {
                            setIsCepLoading(true);
                            try {
                              const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                              const data = await response.json();
                              if (!data.erro) {
                                setBusinessData(prev => ({
                                  ...prev,
                                  cep: formattedCep,
                                  address: data.logradouro || prev.address,
                                  bairro: data.bairro || prev.bairro,
                                  city: data.localidade || prev.city,
                                  state: data.uf || prev.state,
                                }));
                                setValidationErrors(prev => ({
                                  ...prev,
                                  address: "",
                                  bairro: "",
                                  city: "",
                                  state: "",
                                }));
                              } else {
                                toast.error("CEP não encontrado");
                              }
                            } catch (error) {
                              console.error("Erro ao buscar CEP:", error);
                              toast.error("Erro ao buscar CEP");
                            } finally {
                              setIsCepLoading(false);
                            }
                          }
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                        className={`pr-10 ${validationErrors.cep ? "border-destructive" : ""}`}
                      />
                      {isCepLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {validationErrors.cep && (
                      <p className="text-xs text-destructive">{validationErrors.cep}</p>
                    )}
                  </div>

                  {/* Address + Number */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label className="flex items-center gap-1">
                        Endereço (Logradouro)
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={businessData.address}
                        onChange={(e) => {
                          setBusinessData({ ...businessData, address: e.target.value });
                          setValidationErrors(prev => ({ ...prev, address: "" }));
                        }}
                        placeholder="Rua, Avenida..."
                        className={validationErrors.address ? "border-destructive" : ""}
                      />
                      {validationErrors.address && (
                        <p className="text-xs text-destructive">{validationErrors.address}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Número
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={businessData.addressNumber}
                        onChange={(e) => {
                          setBusinessData({ ...businessData, addressNumber: e.target.value });
                          setValidationErrors(prev => ({ ...prev, addressNumber: "" }));
                        }}
                        placeholder="123"
                        className={validationErrors.addressNumber ? "border-destructive" : ""}
                      />
                      {validationErrors.addressNumber && (
                        <p className="text-xs text-destructive">{validationErrors.addressNumber}</p>
                      )}
                    </div>
                  </div>

                  {/* Bairro */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Bairro
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={businessData.bairro}
                      onChange={(e) => {
                        setBusinessData({ ...businessData, bairro: e.target.value });
                        setValidationErrors(prev => ({ ...prev, bairro: "" }));
                      }}
                      placeholder="Nome do bairro"
                      className={validationErrors.bairro ? "border-destructive" : ""}
                    />
                    {validationErrors.bairro && (
                      <p className="text-xs text-destructive">{validationErrors.bairro}</p>
                    )}
                  </div>

                  {/* City / State */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Cidade
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={businessData.city}
                        onChange={(e) => {
                          setBusinessData({ ...businessData, city: e.target.value });
                          setValidationErrors(prev => ({ ...prev, city: "" }));
                        }}
                        className={validationErrors.city ? "border-destructive" : ""}
                      />
                      {validationErrors.city && (
                        <p className="text-xs text-destructive">{validationErrors.city}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Estado
                        <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={businessData.state}
                        onValueChange={(value) => {
                          setBusinessData({ ...businessData, state: value });
                          setValidationErrors(prev => ({ ...prev, state: "" }));
                        }}
                      >
                        <SelectTrigger className={validationErrors.state ? "border-destructive" : ""}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {states.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.state && (
                        <p className="text-xs text-destructive">{validationErrors.state}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Grupo 3: Identidade Fiscal */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Identidade Fiscal
                  </CardTitle>
                  <CardDescription>
                    Documentos fiscais e data de nascimento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* CPF/CNPJ */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      CPF/CNPJ
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={businessData.cpfCnpj}
                      onChange={(e) => {
                        setBusinessData({ ...businessData, cpfCnpj: e.target.value });
                        setValidationErrors(prev => ({ ...prev, cpfCnpj: "" }));
                      }}
                      placeholder="000.000.000-00 ou 00.000.000/0001-00"
                      className={validationErrors.cpfCnpj ? "border-destructive" : ""}
                    />
                    {validationErrors.cpfCnpj && (
                      <p className="text-xs text-destructive">{validationErrors.cpfCnpj}</p>
                    )}
                  </div>

                  {/* Birth Date */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      Data de Nascimento
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={businessData.birthDate}
                      onChange={(e) => {
                        setBusinessData({ ...businessData, birthDate: e.target.value });
                        setValidationErrors(prev => ({ ...prev, birthDate: "" }));
                      }}
                      className={validationErrors.birthDate ? "border-destructive" : ""}
                    />
                    {validationErrors.birthDate && (
                      <p className="text-xs text-destructive">{validationErrors.birthDate}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Data de nascimento do responsável legal
                    </p>
                  </div>
                </CardContent>
              </Card>


              {/* Actions for Company tab */}
              <Button
                size="lg"
                className="w-full"
                onClick={handleSaveCompany}
                disabled={isLoading || isSubmittingWebhook || !isCompanyFormValid()}
              >
                {(isLoading || isSubmittingWebhook) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isSubmittingWebhook ? "Ativando conta bancária..." : "Salvando..."}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {hasAsaasApiKey ? "Salvar Dados da Empresa" : "Salvar e Ativar Conta Bancária"}
                  </>
                )}
              </Button>

              {!isCompanyFormValid() && (
                <p className="text-sm text-center text-muted-foreground">
                  Preencha todos os campos obrigatórios marcados com <span className="text-destructive">*</span>
                </p>
              )}
            </TabsContent>

            {/* Tab 3: Dados Bancários - Conditional based on asaas_api_key */}
            <TabsContent value="banking" className="space-y-6 mt-6">
              {!hasAsaasApiKey ? (
                // Empty state when asaas_api_key is null
                <Card className="relative overflow-hidden">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mb-4">
                      <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Conta Bancária Não Ativada
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2 max-w-sm">
                      Para habilitar os dados bancários e começar a receber pagamentos, você precisa preencher todos os dados obrigatórios na aba "Empresa" e salvar.
                    </p>
                    <p className="text-xs text-muted-foreground mb-6 max-w-sm">
                      Após salvar os dados da empresa, sua conta bancária será ativada automaticamente.
                    </p>
                    <Button
                      onClick={() => setActiveTab("company")}
                    >
                      <Building2 className="w-4 h-4 mr-2" />
                      Preencher Dados da Empresa
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                // Banking form when asaas_api_key exists
                <>
                  {/* Account Status Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-primary" />
                        Status da Conta
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl">
                        <CheckCircle className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">Conta Asaas Conectada</p>
                          <p className="text-sm text-muted-foreground">
                            Sua conta está configurada para receber pagamentos
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Banking Form */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Landmark className="w-5 h-5 text-primary" />
                        Dados para Recebimento
                      </CardTitle>
                      <CardDescription>
                        Configure como deseja receber seus pagamentos
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Operation Type Toggle */}
                      <div className="space-y-2">
                        <Label>Tipo de Operação</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={bankingData.operationType === "PIX" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setBankingData({ ...bankingData, operationType: "PIX" })}
                          >
                            PIX
                          </Button>
                          <Button
                            type="button"
                            variant={bankingData.operationType === "TED" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setBankingData({ ...bankingData, operationType: "TED" })}
                          >
                            TED
                          </Button>
                        </div>
                      </div>

                      {/* Conditional Fields for PIX */}
                      {bankingData.operationType === "PIX" && (
                        <>
                          <div className="space-y-2">
                            <Label>Tipo de Chave PIX</Label>
                            <Select
                              value={bankingData.pixKeyType}
                              onValueChange={(value) =>
                                setBankingData({ ...bankingData, pixKeyType: value as any })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo de chave" />
                              </SelectTrigger>
                              <SelectContent>
                                {pixKeyTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Chave PIX</Label>
                            <Input
                              value={bankingData.pixKey}
                              onChange={(e) =>
                                setBankingData({ ...bankingData, pixKey: e.target.value })
                              }
                              placeholder={
                                bankingData.pixKeyType === "CPF" ? "000.000.000-00" :
                                bankingData.pixKeyType === "CNPJ" ? "00.000.000/0001-00" :
                                bankingData.pixKeyType === "EMAIL" ? "email@exemplo.com" :
                                bankingData.pixKeyType === "PHONE" ? "(11) 99999-9999" :
                                "Cole sua chave aleatória"
                              }
                            />
                          </div>
                        </>
                      )}

                      {/* Conditional Fields for TED */}
                      {bankingData.operationType === "TED" && (
                        <>
                          <div className="space-y-2">
                            <Label>Código do Banco</Label>
                            <Input
                              value={bankingData.bankCode}
                              onChange={(e) =>
                                setBankingData({ ...bankingData, bankCode: e.target.value })
                              }
                              placeholder="Ex: 001, 341, 104..."
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Agência</Label>
                              <Input
                                value={bankingData.bankBranch}
                                onChange={(e) =>
                                  setBankingData({ ...bankingData, bankBranch: e.target.value })
                                }
                                placeholder="0000"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Dígito da Agência</Label>
                              <Input
                                value=""
                                disabled
                                placeholder="Opcional"
                                className="bg-muted"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                              <Label>Número da Conta</Label>
                              <Input
                                value={bankingData.bankAccountNumber}
                                onChange={(e) =>
                                  setBankingData({ ...bankingData, bankAccountNumber: e.target.value })
                                }
                                placeholder="00000000"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Dígito</Label>
                              <Input
                                value={bankingData.bankAccountDigit}
                                onChange={(e) =>
                                  setBankingData({ ...bankingData, bankAccountDigit: e.target.value })
                                }
                                placeholder="0"
                                maxLength={2}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Save Banking Button */}
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleSaveBanking}
                    disabled={isLoading}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isLoading ? "Salvando..." : "Salvar Configurações Bancárias"}
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          /* Non-owner view - Simple profile only */
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                    {profileData.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {profileData.name}
                    </h2>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Nome
                  </Label>
                  <Input
                    value={profileData.name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, name: e.target.value })
                    }
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    Celular
                  </Label>
                  <Input
                    value={profileData.phone}
                    onChange={(e) =>
                      setProfileData({ ...profileData, phone: e.target.value })
                    }
                  />
                </div>

                {/* Email - Read Only */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    E-mail
                    <span className="text-xs text-muted-foreground">(somente leitura)</span>
                  </Label>
                  <Input
                    value={profileData.email}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                </div>
              </CardContent>
            </Card>


            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                size="lg"
                className="w-full sm:flex-1"
                onClick={handleSaveProfile}
                disabled={isLoading}
              >
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? "Salvando..." : "Salvar alterações"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair da conta
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
