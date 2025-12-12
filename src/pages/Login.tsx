import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Clock, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const navigate = useNavigate();
  const { signIn, user, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Check if user logged in via Google is new (created in last 30 seconds)
  useEffect(() => {
    if (!loading && user) {
      const createdAt = new Date(user.created_at).getTime();
      const now = Date.now();
      const isNewUser = now - createdAt < 30000; // 30 seconds threshold
      
      // Check if this is a Google OAuth user
      const isGoogleUser = user.app_metadata?.provider === "google" || 
                          user.identities?.some(i => i.provider === "google");
      
      if (isNewUser && isGoogleUser) {
        // New Google user trying to login - sign them out and redirect to register
        supabase.auth.signOut().then(() => {
          toast.error("Conta não encontrada. Complete seu cadastro primeiro.");
          navigate("/register?from=google");
        });
      } else {
        // Existing user - proceed to dashboard
        navigate("/dashboard");
      }
    }
  }, [user, loading, navigate]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      toast.error("Erro ao conectar com Google");
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error("Preencha todos os campos");
      return;
    }

    setIsLoading(true);

    const { error } = await signIn(formData.email, formData.password);

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("E-mail ou senha incorretos");
      } else if (error.message.includes("Email not confirmed")) {
        toast.error("Confirme seu e-mail antes de fazer login");
      } else {
        toast.error(error.message);
      }
      setIsLoading(false);
      return;
    }

    toast.success("Login realizado com sucesso!");
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
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow mb-6">
              <Clock className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Bem-vindo de volta</h1>
            <p className="text-muted-foreground mt-2">
              Entre na sua conta para continuar
            </p>
          </div>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            size="xl"
            className="w-full"
            disabled={isGoogleLoading}
            onClick={handleGoogleLogin}
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
            {isGoogleLoading ? "Conectando..." : "Entrar com Google"}
          </Button>

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
          <form onSubmit={handleSubmit} className="space-y-5">
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
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
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

            <Button
              type="submit"
              size="xl"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          {/* Register link */}
          <p className="text-center text-sm text-muted-foreground">
            Não tem uma conta?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Criar conta
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
            Gerencie seu negócio de forma inteligente com agentes de IA, agendamentos automáticos e muito mais.
          </p>
        </div>
      </div>
    </div>
  );
}
