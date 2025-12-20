import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
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
  Smartphone,
  CheckCircle,
  Download,
  Link,
  Copy,
  Check,
  Loader2,
  Landmark,
  Calendar,
} from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { useBarbershop } from "@/hooks/useBarbershop";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LogoUploader } from "@/components/settings/LogoUploader";
import { formatPhoneMask } from "@/lib/phoneMask";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface OutletContextType {
  onMenuClick: () => void;
}

export default function Settings() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isOwner } = useBarbershop();
  const { isInstalled, isInstallable, isMobile, promptInstall } = usePWA();
  const [isLoading, setIsLoading] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [slugCopied, setSlugCopied] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [activeTab, setActiveTab] = useState("profile");
  
  // Profile photo upload
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  // User profile data (from user_settings)
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    email: "",
    birthDate: "",
  });
  
  // Business data (from barbershops) - only for owners
  const [businessData, setBusinessData] = useState({
    company: "",
    slug: "",
    publicPhone: "",
    logoUrl: "",
    niche: "",
    subNiche: "",
    cpfCnpj: "",
    cep: "",
    address: "",
    addressNumber: "",
    bairro: "",
    city: "",
    state: "",
  });

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

  const loadData = async () => {
    if (!user) return;
    
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
        birthDate: "",
      });
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
          slug: barbershop.slug || "",
          publicPhone: barbershop.phone || "",
          logoUrl: barbershop.logo_url || "",
          niche: barbershop.nicho || "",
          subNiche: barbershop.subnicho || "",
          cpfCnpj: barbershop.cpf_cnpj || "",
          cep: barbershop.cep || "",
          address: barbershop.address || "",
          addressNumber: barbershop.address_number || "",
          bairro: barbershop.bairro || "",
          city: barbershop.city || "",
          state: barbershop.state || "",
        });

        // Load birth date from new column
        setProfileData(prev => ({
          ...prev,
          birthDate: (barbershop as any).bank_owner_birth_date || "",
        }));

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
  };

  // Generate slug from company name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  // Handle slug change
  const handleSlugChange = (value: string) => {
    const formatted = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setBusinessData({ ...businessData, slug: formatted });
    setSlugError("");
  };

  // Copy public link to clipboard
  const copyPublicLink = () => {
    const link = `${window.location.origin}/a/${businessData.slug}`;
    navigator.clipboard.writeText(link);
    setSlugCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setSlugCopied(false), 2000);
  };

  // Handle profile photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("barbershop-logos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("barbershop-logos")
        .getPublicUrl(filePath);

      setProfilePhotoUrl(publicUrl);
      toast.success("Foto atualizada!");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Erro ao enviar foto");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);
    setSlugError("");

    // Validate birth date if CPF
    if (businessData.cpfCnpj && isCpf(businessData.cpfCnpj) && !profileData.birthDate) {
      toast.error("Data de nascimento é obrigatória para CPF");
      setIsLoading(false);
      setActiveTab("profile");
      return;
    }

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

    // Save business data to barbershops - only for owners
    if (barbershopId && isOwner) {
      // Check slug uniqueness if slug is provided
      if (businessData.slug) {
        const { data: existingSlug } = await supabase
          .from("barbershops")
          .select("id")
          .eq("slug", businessData.slug)
          .neq("id", barbershopId)
          .maybeSingle();

        if (existingSlug) {
          setSlugError("Este link já está em uso. Escolha outro.");
          toast.error("Este link já está em uso");
          setIsLoading(false);
          return;
        }
      }

      const { error: businessError } = await supabase
        .from("barbershops")
        .update({
          name: businessData.company,
          slug: businessData.slug || null,
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
          bank_owner_birth_date: profileData.birthDate || null,
        })
        .eq("id", barbershopId);

      if (businessError) {
        toast.error("Erro ao salvar dados da empresa");
        setIsLoading(false);
        return;
      }
    }

    toast.success("Configurações salvas com sucesso");
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
      <Header title="Configurações" subtitle="Gerencie sua conta" onMenuClick={onMenuClick} />

      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
        {isOwner && barbershopId ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Perfil & Empresa
              </TabsTrigger>
              <TabsTrigger value="banking" className="flex items-center gap-2">
                <Landmark className="w-4 h-4" />
                Dados Bancários
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Perfil & Empresa */}
            <TabsContent value="profile" className="space-y-6 mt-6">
              {/* Profile Section */}
              <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Identidade Pessoal
                </h3>

                <div className="space-y-4">
                  {/* Profile Photo - Square 1:1 */}
                  <div className="flex items-center gap-4">
                    <label className="relative cursor-pointer group">
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
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={isUploadingPhoto}
                      />
                    </label>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Foto de perfil (1:1)</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG ou GIF. Máx 5MB</p>
                    </div>
                  </div>

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

                  {/* Birth Date - Conditional */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      Data de Nascimento
                      {businessData.cpfCnpj && isCpf(businessData.cpfCnpj) && (
                        <span className="text-xs text-destructive">*obrigatório</span>
                      )}
                    </Label>
                    <Input
                      type="date"
                      value={profileData.birthDate}
                      onChange={(e) =>
                        setProfileData({ ...profileData, birthDate: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Obrigatório se o documento for CPF
                    </p>
                  </div>
                </div>
              </div>

              {/* Company Section */}
              <div className="bg-card rounded-2xl shadow-card p-6 animate-slide-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Dados da Empresa
                </h3>

                <div className="space-y-6">
                  {/* Logo Upload - Square 1:1 */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <LogoUploader
                      logoUrl={businessData.logoUrl}
                      barbershopId={barbershopId}
                      barbershopName={businessData.company || "B"}
                      onLogoChange={(url) => setBusinessData({ ...businessData, logoUrl: url })}
                    />
                    <div className="flex-1 space-y-2">
                      {/* Company Name */}
                      <Label>Nome da Empresa</Label>
                      <Input
                        value={businessData.company}
                        onChange={(e) => {
                          setBusinessData({ ...businessData, company: e.target.value });
                          // Auto-suggest slug if empty
                          if (!businessData.slug) {
                            const suggestedSlug = generateSlug(e.target.value);
                            setBusinessData(prev => ({ ...prev, company: e.target.value, slug: suggestedSlug }));
                          }
                        }}
                        placeholder="Nome da sua barbearia"
                      />
                    </div>
                  </div>

                  {/* Public Link (Slug) */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-muted-foreground" />
                      Link de Agendamento (Slug)
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center rounded-md border border-input bg-background">
                        <span className="px-3 py-2 text-sm text-muted-foreground bg-muted rounded-l-md border-r whitespace-nowrap">
                          {window.location.origin}/a/
                        </span>
                        <Input
                          value={businessData.slug}
                          onChange={(e) => handleSlugChange(e.target.value)}
                          placeholder="minha-barbearia"
                          className="border-0 rounded-l-none focus-visible:ring-0"
                        />
                      </div>
                      {businessData.slug && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={copyPublicLink}
                        >
                          {slugCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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

                  {/* CPF/CNPJ */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      CPF/CNPJ
                    </Label>
                    <Input
                      value={businessData.cpfCnpj}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, cpfCnpj: e.target.value })
                      }
                      placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    />
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="bg-card rounded-2xl shadow-card p-6 animate-slide-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Endereço Completo
                </h3>

                <div className="space-y-4">
                  {/* CEP */}
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <div className="relative">
                      <Input
                        value={businessData.cep}
                        onChange={async (e) => {
                          const cep = e.target.value.replace(/\D/g, "");
                          const formattedCep = cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5, 8)}` : cep;
                          setBusinessData({ ...businessData, cep: formattedCep });
                          
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
                              }
                            } catch (error) {
                              console.error("Erro ao buscar CEP:", error);
                            } finally {
                              setIsCepLoading(false);
                            }
                          }
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                        className="pr-10"
                      />
                      {isCepLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Address + Number */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label>Endereço (Logradouro)</Label>
                      <Input
                        value={businessData.address}
                        onChange={(e) =>
                          setBusinessData({ ...businessData, address: e.target.value })
                        }
                        placeholder="Rua, Avenida..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input
                        value={businessData.addressNumber}
                        onChange={(e) =>
                          setBusinessData({ ...businessData, addressNumber: e.target.value })
                        }
                        placeholder="123"
                      />
                    </div>
                  </div>

                  {/* Bairro */}
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={businessData.bairro}
                      onChange={(e) =>
                        setBusinessData({ ...businessData, bairro: e.target.value })
                      }
                      placeholder="Nome do bairro"
                    />
                  </div>

                  {/* City / State */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input
                        value={businessData.city}
                        onChange={(e) =>
                          setBusinessData({ ...businessData, city: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select
                        value={businessData.state}
                        onValueChange={(value) =>
                          setBusinessData({ ...businessData, state: value })
                        }
                      >
                        <SelectTrigger>
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
                    </div>
                  </div>
                </div>
              </div>

              {/* PWA Download Section - Only on mobile/tablet */}
              {isMobile && (
                <div className="bg-card rounded-2xl shadow-card p-6 animate-slide-up">
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    Aplicativo
                  </h3>

                  {isInstalled ? (
                    <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Aplicativo instalado</p>
                        <p className="text-sm text-muted-foreground">
                          Você já tem o Skejool instalado no seu dispositivo
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Tenha acesso rápido ao Skejool direto da tela inicial do seu celular
                      </p>
                      <Button
                        onClick={() => {
                          if (isInstallable) {
                            promptInstall();
                          } else {
                            navigate("/instalar");
                          }
                        }}
                        className="w-full sm:w-auto"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar Aplicativo
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Actions for Profile tab */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  size="lg"
                  className="w-full sm:flex-1"
                  onClick={handleSave}
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
            </TabsContent>

            {/* Tab 2: Dados Bancários */}
            <TabsContent value="banking" className="space-y-6 mt-6">
              <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-primary" />
                  Dados para Recebimento (Asaas)
                </h3>

                <div className="space-y-6">
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
                </div>
              </div>

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
            </TabsContent>
          </Tabs>
        ) : (
          /* Non-owner view - Simple profile only */
          <>
            <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                  {profileData.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {profileData.name}
                  </h2>
                </div>
              </div>

              <div className="space-y-4">
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
              </div>
            </div>

            {/* PWA Download Section - Only on mobile/tablet */}
            {isMobile && (
              <div className="bg-card rounded-2xl shadow-card p-6 animate-slide-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  Aplicativo
                </h3>

                {isInstalled ? (
                  <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">Aplicativo instalado</p>
                      <p className="text-sm text-muted-foreground">
                        Você já tem o Skejool instalado no seu dispositivo
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Tenha acesso rápido ao Skejool direto da tela inicial do seu celular
                    </p>
                    <Button
                      onClick={() => {
                        if (isInstallable) {
                          promptInstall();
                        } else {
                          navigate("/instalar");
                        }
                      }}
                      className="w-full sm:w-auto"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar Aplicativo
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                size="lg"
                className="w-full sm:flex-1"
                onClick={handleSave}
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
