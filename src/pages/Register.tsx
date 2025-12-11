import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Clock, Eye, EyeOff, Mail, Lock, User, Phone, Building2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PlanSelector } from "@/components/subscription/PlanSelector";

type RegistrationStep = "plan-selection" | "form";

interface Plan {
  slug: string;
  name: string;
  price: number;
  max_agents: number;
  max_whatsapp: number;
  max_services: number | null;
  max_appointments_month: number | null;
}

export default function Register() {
  const navigate = useNavigate();
  const { signUp, user, loading } = useAuth();
  const [step, setStep] = useState<RegistrationStep>("plan-selection");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    barbershopName: "",
    password: "",
  });

  // Fetch plans
  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true);

      if (!error && data) {
        setPlans(data as Plan[]);
      }
      setLoadingPlans(false);
    };

    fetchPlans();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const handleSelectPlan = (planSlug: string) => {
    setSelectedPlan(planSlug);
    setStep("form");
  };

  const handleBackToPlanSelection = () => {
    setStep("plan-selection");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.email || !formData.barbershopName || !formData.password) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (!selectedPlan) {
      toast.error("Selecione um plano");
      return;
    }

    setIsLoading(true);

    // Sign up with metadata including plan_slug for the database trigger
    const { error } = await signUp(formData.email, formData.password, {
      nome: formData.name,
      numero: formData.phone,
      nome_empresa: formData.barbershopName,
      plan_slug: selectedPlan,
    });

    if (error) {
      if (error.message.includes("User already registered")) {
        toast.error("Este e-mail já está cadastrado");
      } else {
        toast.error(error.message);
      }
      setIsLoading(false);
      return;
    }

    // The database trigger handles creating user_settings and subscription
    // Just show success message and redirect
    toast.success("Conta criada com sucesso! Verifique seu e-mail para confirmar ou faça login.");
    setIsLoading(false);
    navigate("/");
  };

  const selectedPlanData = plans.find(p => p.slug === selectedPlan);

  if (loading || loadingPlans) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Plan selection step - full screen centered layout
  if (step === "plan-selection") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-4xl animate-fade-in">
          {/* Logo SKEJOOL */}
          <div className="flex items-center justify-center font-extrabold tracking-tighter select-none text-3xl md:text-4xl mb-8 text-foreground">
            <span>S</span>
            <span>K</span>
            <span>E</span>
            <span>J</span>
            <span className="text-primary inline-flex items-center justify-center mx-[2px] hover:rotate-180 transition-transform duration-700 ease-in-out">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v6l4 2"></path>
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
            </span>
            <span>O</span>
            <span>L</span>
          </div>

          <PlanSelector 
            plans={plans} 
            onSelectPlan={handleSelectPlan} 
            loading={isLoading}
          />
          {/* Login link */}
          <p className="text-center text-sm text-muted-foreground mt-8">
            Já tem uma conta?{" "}
            <Link to="/" className="text-primary font-medium hover:underline">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Form step - split layout with image
  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-6 animate-fade-in py-8">
          {/* Back button and Plan info */}
          <div className="space-y-4">
            <button
              onClick={handleBackToPlanSelection}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para planos
            </button>

            {/* Selected plan badge */}
            {selectedPlanData && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <span>Plano {selectedPlanData.name}</span>
                <span className="text-xs opacity-75">
                  R$ {selectedPlanData.price.toFixed(2).replace(".", ",")}/mês
                </span>
              </div>
            )}
          </div>

          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow mb-6">
              <Clock className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Crie sua conta</h1>
            <p className="text-muted-foreground mt-2">
              Comece seu teste grátis de 7 dias
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="João Silva"
                  className="pl-10 h-12"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Celular</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  className="pl-10 h-12"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10 h-12"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="barbershopName">Nome da barbearia</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="barbershopName"
                  type="text"
                  placeholder="Barbearia do João"
                  className="pl-10 h-12"
                  value={formData.barbershopName}
                  onChange={(e) =>
                    setFormData({ ...formData, barbershopName: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  className="pl-10 pr-10 h-12"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="xl"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Criando conta..." : "Criar conta e começar teste grátis"}
              </Button>
            </div>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/" className="text-primary font-medium hover:underline">
              Fazer login
            </Link>
          </p>

          {/* Footer links */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4 border-t border-border">
            <Link to="/suporte" className="hover:text-primary transition-colors">
              Suporte
            </Link>
            <span>•</span>
            <Link to="/privacidade" className="hover:text-primary transition-colors">
              Privacidade
            </Link>
            <span>•</span>
            <Link to="/termos" className="hover:text-primary transition-colors">
              Termos
            </Link>
          </div>
        </div>
      </div>

      {/* Right side - Decorative with barbershop image */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center p-12 overflow-hidden">
        {/* Background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center blur-[2px] scale-105"
          style={{ backgroundImage: "url('/images/barbershop-background.jpg')" }}
        />
        
        {/* Blue overlay with gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#139ED0]/70 to-[#1BB0E9]/65" />
        
        {/* Content */}
        <div className="relative z-10 text-center text-white max-w-md animate-slide-up">
          <div className="flex items-center justify-center font-extrabold tracking-tighter select-none text-4xl mb-8">
            <span>S</span>
            <span>K</span>
            <span>E</span>
            <span>J</span>
            <span className="text-white/80 inline-flex items-center justify-center mx-[2px] hover:rotate-180 transition-transform duration-700 ease-in-out">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v6l4 2"></path>
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
            </span>
            <span>O</span>
            <span>L</span>
          </div>
          <p className="text-lg opacity-90">
            Automatize agendamentos, gerencie serviços e deixe a IA atender seus clientes pelo WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
