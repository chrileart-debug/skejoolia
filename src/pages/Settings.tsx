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
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    company: "",
    niche: "",
    subNiche: "",
    cnpj: "",
    address: "",
    city: "",
    state: "",
    email: "",
  });

  // Load user settings
  useEffect(() => {
    if (user) {
      loadUserSettings();
    }
  }, [user]);

  const loadUserSettings = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setFormData({
        name: data.nome || "",
        phone: data.numero || "",
        company: data.nome_empresa || "",
        niche: data.nicho || "",
        subNiche: data.subnicho || "",
        cnpj: data.cnpj || "",
        address: data.endereco || "",
        city: data.cidade || "",
        state: data.estado || "",
        email: data.email || user.email || "",
      });
    } else {
      setFormData(prev => ({ ...prev, email: user.email || "" }));
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);

    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        nome: formData.name,
        numero: formData.phone,
        nome_empresa: formData.company,
        nicho: formData.niche,
        subnicho: formData.subNiche,
        cnpj: formData.cnpj,
        endereco: formData.address,
        cidade: formData.city,
        estado: formData.state,
        email: formData.email,
      });

    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      toast.success("Configurações salvas com sucesso");
    }
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
              {formData.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {formData.name}
              </h2>
              <p className="text-sm text-muted-foreground">{formData.company}</p>
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
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
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
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
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
                value={formData.email}
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
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
              />
            </div>

            {/* Niche / SubNiche */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nicho</Label>
                <Input
                  value={formData.niche}
                  onChange={(e) =>
                    setFormData({ ...formData, niche: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Subnicho</Label>
                <Input
                  value={formData.subNiche}
                  onChange={(e) =>
                    setFormData({ ...formData, subNiche: e.target.value })
                  }
                />
              </div>
            </div>

            {/* CNPJ */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                CNPJ
              </Label>
              <Input
                value={formData.cnpj}
                onChange={(e) =>
                  setFormData({ ...formData, cnpj: e.target.value })
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
            {/* Address */}
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>

            {/* City / State */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) =>
                    setFormData({ ...formData, state: value })
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
            className="flex-1"
            onClick={handleSave}
            disabled={isLoading}
          >
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
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
