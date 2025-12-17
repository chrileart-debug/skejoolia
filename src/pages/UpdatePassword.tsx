import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, Eye, EyeOff, Clock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: "Mínimo 8 caracteres", test: (p) => p.length >= 8 },
  { label: "Uma letra maiúscula", test: (p) => /[A-Z]/.test(p) },
  { label: "Uma letra minúscula", test: (p) => /[a-z]/.test(p) },
  { label: "Um número", test: (p) => /[0-9]/.test(p) },
];

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordValidation = useMemo(() => {
    return passwordRequirements.map((req) => ({
      ...req,
      valid: req.test(password),
    }));
  }, [password]);

  const isPasswordValid = passwordValidation.every((req) => req.valid);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.error("A senha não atende aos requisitos de segurança");
      return;
    }

    if (!passwordsMatch) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      // Activate team member status after successful password set
      const { error: activateError } = await supabase.rpc('activate_team_member_status');
      if (activateError) {
        console.error("Error activating team member status:", activateError);
        // Don't fail - password was updated successfully
      }

      toast.success("Senha definida com sucesso!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Erro ao definir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              SKEJ<span className="text-primary">O</span>OL
            </CardTitle>
            <CardDescription className="mt-2">
              Defina sua senha para acessar a plataforma
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password requirements checklist */}
              {password.length > 0 && (
                <div className="mt-3 space-y-1.5 p-3 bg-muted/50 rounded-lg">
                  {passwordValidation.map((req, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 text-sm transition-colors ${
                        req.valid ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                      }`}
                    >
                      {req.valid ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      <span>{req.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password match indicator */}
              {confirmPassword.length > 0 && (
                <div
                  className={`flex items-center gap-2 text-sm mt-2 ${
                    passwordsMatch ? "text-green-600 dark:text-green-400" : "text-destructive"
                  }`}
                >
                  {passwordsMatch ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  <span>{passwordsMatch ? "Senhas coincidem" : "Senhas não coincidem"}</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !isPasswordValid || !passwordsMatch}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Senha"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
