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
} from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { useBarbershop } from "@/hooks/useBarbershop";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LogoUploader } from "@/components/settings/LogoUploader";
import { formatPhoneMask } from "@/lib/phoneMask";

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
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [slugCopied, setSlugCopied] = useState(false);
  const [slugError, setSlugError] = useState("");
  
  // User profile data (from user_settings)
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    email: "",
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

  // Validate slug format
  const validateSlugFormat = (slug: string) => {
    return /^[a-z0-9-]*$/.test(slug);
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

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);
    setSlugError("");

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

  return (
    <div className="min-h-screen">
      <Header title="Configurações" subtitle="Gerencie sua conta" onMenuClick={onMenuClick} />

      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
        {/* Profile Section - Always visible */}
        <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
              {profileData.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {profileData.name}
              </h2>
              {isOwner && <p className="text-sm text-muted-foreground">{businessData.company}</p>}
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

        {/* Business Section - Only for owners */}
        {isOwner && barbershopId && (
          <div className="bg-card rounded-2xl shadow-card p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Dados da Empresa
            </h3>

            <div className="space-y-6">
              {/* Logo Upload */}
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

              {/* Public Phone (WhatsApp) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Telefone da Loja (WhatsApp)
                </Label>
                <Input
                  value={businessData.publicPhone}
                  onChange={(e) =>
                    setBusinessData({ ...businessData, publicPhone: formatPhoneMask(e.target.value) })
                  }
                  placeholder="(11) 99999-9999"
                />
                <p className="text-xs text-muted-foreground">
                  Número exibido na página pública de agendamento
                </p>
              </div>

              {/* Niche / SubNiche */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nicho</Label>
                  <Input
                    value={businessData.niche}
                    onChange={(e) =>
                      setBusinessData({ ...businessData, niche: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subnicho</Label>
                  <Input
                    value={businessData.subNiche}
                    onChange={(e) =>
                      setBusinessData({ ...businessData, subNiche: e.target.value })
                    }
                  />
                </div>
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
                />
              </div>
            </div>
          </div>
        )}

        {/* Address Section - Only for owners */}
        {isOwner && (
          <div className="bg-card rounded-2xl shadow-card p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Endereço
            </h3>

            <div className="space-y-4">
              {/* CEP */}
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={businessData.cep}
                  onChange={async (e) => {
                    const cep = e.target.value.replace(/\D/g, "");
                    const formattedCep = cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5, 8)}` : cep;
                    setBusinessData({ ...businessData, cep: formattedCep });
                    
                    if (cep.length === 8) {
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
                      }
                    }
                  }}
                  placeholder="00000-000"
                  maxLength={9}
                />
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
        )}


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
      </div>
    </div>
  );
}
