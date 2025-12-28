import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFacebookPixel, generateEventId } from "@/hooks/useFacebookPixel";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { trackLead } = useFacebookPixel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Digite seu e-mail");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error("Erro ao enviar e-mail de recuperação");
      setIsLoading(false);
      return;
    }

    // Track Lead event (user re-engaged by requesting password reset)
    trackLead({
      contentName: "Password Reset Request",
      eventId: generateEventId(),
    });

    setEmailSent(true);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow mb-6">
            <Clock className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {emailSent ? "E-mail enviado!" : "Esqueceu sua senha?"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {emailSent
              ? "Verifique sua caixa de entrada"
              : "Digite seu e-mail para recuperar sua senha"}
          </p>
        </div>

        {emailSent ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-primary/10 border border-primary/20">
              <CheckCircle className="w-12 h-12 text-primary mb-4" />
              <p className="text-center text-sm text-muted-foreground">
                Enviamos um link de recuperação para <strong className="text-foreground">{email}</strong>. 
                Clique no link do e-mail para redefinir sua senha.
              </p>
            </div>

            <Button
              variant="outline"
              size="xl"
              className="w-full"
              onClick={() => setEmailSent(false)}
            >
              Enviar novamente
            </Button>
          </div>
        ) : (
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              size="xl"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
          </form>
        )}

        {/* Back to login */}
        <Link
          to="/login"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
