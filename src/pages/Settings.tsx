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
} from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface OutletContextType {
  onMenuClick: () => void;
}

export default function Settings() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isInstalled, isInstallable, isMobile, promptInstall } = usePWA();
  const [isLoading, setIsLoading] = useState(false);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  
  // User profile data (from user_settings)
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    email: "",
  });
  
  // Business data (from barbershops)
  const [businessData, setBusinessData] = useState({
    company: "",
    niche: "",
    subNiche: "",
    cpfCnpj: "",
    cep: "",
    address: "",
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
          niche: barbershop.nicho || "",
          subNiche: barbershop.subnicho || "",
          cpfCnpj: barbershop.cpf_cnpj || "",
          cep: barbershop.cep || "",
          address: barbershop.address || "",
          city: barbershop.city || "",
          state: barbershop.state || "",
        });
      }
    }
  };

  const handleSave = async () => {
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

    // Save business data to barbershops
    if (barbershopId) {
      const { error: businessError } = await supabase
        .from("barbershops")
        .update({
          name: businessData.company,
          nicho: businessData.niche,
          subnicho: businessData.subNiche,
          cpf_cnpj: businessData.cpfCnpj,
          cep: businessData.cep,
          address: businessData.address,
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
        {/* Profile Section */}
        <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
              {profileData.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {profileData.name}
              </h2>
              <p className="text-sm text-muted-foreground">{businessData.company}</p>
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

        {/* Business Section */}
        <div className="bg-card rounded-2xl shadow-card p-6 animate-slide-up">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Dados da Empresa
          </h3>

          <div className="space-y-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input
                value={businessData.company}
                onChange={(e) =>
                  setBusinessData({ ...businessData, company: e.target.value })
                }
              />
            </div>

            {/* Niche / SubNiche */}
            <div className="grid grid-cols-2 gap-4">
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

        {/* Address Section */}
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
                onChange={(e) =>
                  setBusinessData({ ...businessData, cep: e.target.value })
                }
                placeholder="00000-000"
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={businessData.address}
                onChange={(e) =>
                  setBusinessData({ ...businessData, address: e.target.value })
                }
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
