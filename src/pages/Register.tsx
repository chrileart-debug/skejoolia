import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const fromGoogle = searchParams.get("from") === "google";
  const planFromUrl = searchParams.get("plan"); // Get plan from URL query param
  const { signUp, user, loading } = useAuth();
  const [step, setStep] = useState<RegistrationStep>("plan-selection");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    barbershopName: "",
    password: "",
  });
  

  // Show message if redirected from login with unregistered Google account
  useEffect(() => {
    if (fromGoogle) {
      toast.info("Use o botão 'Cadastrar com Google' para criar sua conta.");
    }
  }, [fromGoogle]);

  // Fetch plans and handle URL plan parameter
  useEffect(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true);

      if (!error && data) {
        setPlans(data as Plan[]);
        
        // If plan is provided in URL, validate and pre-select it
        if (planFromUrl) {
          const validPlan = data.find((p: Plan) => p.slug === planFromUrl);
          if (validPlan) {
            setSelectedPlan(planFromUrl);
            setStep("form"); // Skip plan selection step
          }
        }
      }
      setLoadingPlans(false);
    };

    fetchPlans();
  }, [planFromUrl]);

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

          {/* Google Sign Up */}
          <Button
            type="button"
            variant="outline"
            size="xl"
            className="w-full"
            disabled={isGoogleLoading}
            onClick={async () => {
              if (!selectedPlan) {
                toast.error("Selecione um plano primeiro");
                return;
              }
              
              // Store selected plan in localStorage before OAuth redirect
              localStorage.setItem("pending_plan_slug", selectedPlan);
              
              setIsGoogleLoading(true);
              const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                  redirectTo: `${window.location.origin}/dashboard`,
                  queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                  },
                },
              });
              if (error) {
                toast.error("Erro ao conectar com Google");
                setIsGoogleLoading(false);
              }
            }}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isGoogleLoading ? "Conectando..." : "Cadastrar com Google"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Ao criar conta, você concorda com os{" "}
            <Link to="/termos" target="_blank" className="text-primary hover:underline">
              Termos de Uso
            </Link>
            {" "}e{" "}
            <Link to="/privacidade" target="_blank" className="text-primary hover:underline">
              Política de Privacidade
            </Link>
          </p>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
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
              <p className="text-xs text-muted-foreground text-center mt-3">
                Ao criar conta, você concorda com os{" "}
                <Link to="/termos" target="_blank" className="text-primary hover:underline">
                  Termos de Uso
                </Link>
                {" "}e{" "}
                <Link to="/privacidade" target="_blank" className="text-primary hover:underline">
                  Política de Privacidade
                </Link>
              </p>
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
