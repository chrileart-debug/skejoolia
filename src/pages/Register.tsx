import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Scissors, Eye, EyeOff, Mail, Lock, User, Phone, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function Register() {
  const navigate = useNavigate();
  const { signUp, user, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    barbershopName: "",
    password: "",
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

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

    setIsLoading(true);

    // Sign up with metadata
    const { error } = await signUp(formData.email, formData.password, {
      nome: formData.name,
      numero: formData.phone,
      nome_empresa: formData.barbershopName,
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

    // Create user_settings record
    const { data: { user: newUser } } = await supabase.auth.getUser();
    
    if (newUser) {
      const { error: settingsError } = await supabase
        .from("user_settings")
        .insert({
          user_id: newUser.id,
          nome: formData.name,
          numero: formData.phone,
          email: formData.email,
          nome_empresa: formData.barbershopName,
        });

      if (settingsError) {
        console.error("Error creating user settings:", settingsError);
      }
    }

    toast.success("Conta criada com sucesso! Verifique seu e-mail para confirmar.");
    navigate("/dashboard");
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-6 animate-fade-in py-8">
          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow mb-6">
              <Scissors className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Crie sua conta</h1>
            <p className="text-muted-foreground mt-2">
              Comece a gerenciar sua barbearia agora
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
                {isLoading ? "Criando conta..." : "Criar conta"}
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
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 gradient-hero items-center justify-center p-12">
        <div className="text-center text-primary-foreground max-w-md animate-slide-up">
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
