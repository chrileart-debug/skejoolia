import { Clock, Download, Share, Plus, Smartphone, CheckCircle2, Zap, Wifi, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePWA } from "@/hooks/usePWA";
import { Link } from "react-router-dom";

export default function Install() {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWA();

  const benefits = [
    { icon: Zap, title: "Acesso Rápido", description: "Abra direto da tela inicial" },
    { icon: Wifi, title: "Funciona Offline", description: "Acesse mesmo sem internet" },
    { icon: Bell, title: "Notificações", description: "Receba alertas importantes" },
    { icon: Smartphone, title: "Tela Cheia", description: "Experiência como app nativo" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 sm:p-6 border-b border-border/50">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground">SKEJOOL</span>
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto w-full">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
            <Clock className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Instale o Skejool
          </h1>
          <p className="text-muted-foreground">
            Tenha acesso rápido ao sistema de gestão direto na tela inicial do seu celular.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {benefits.map((benefit) => (
            <Card key={benefit.title} className="bg-card/50 border-border/50">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-primary/10 flex items-center justify-center">
                  <benefit.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium text-foreground text-sm mb-1">{benefit.title}</h3>
                <p className="text-xs text-muted-foreground">{benefit.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Installation Section */}
        {isInstalled ? (
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                App Instalado!
              </h2>
              <p className="text-muted-foreground mb-4">
                O Skejool já está instalado no seu dispositivo.
              </p>
              <Link to="/dashboard">
                <Button className="w-full">
                  Ir para o Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : isIOS ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 text-center">
                Como instalar no iPhone/iPad
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-medium">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Toque no botão Compartilhar</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Share className="w-4 h-4" /> No Safari, toque no ícone de compartilhar
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-medium">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Role para baixo</p>
                    <p className="text-sm text-muted-foreground">
                      Procure a opção "Adicionar à Tela de Início"
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-medium">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground flex items-center gap-1">
                      Toque em <Plus className="w-4 h-4" /> Adicionar
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Confirme para adicionar o Skejool à sua tela inicial
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : isInstallable ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <Download className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Pronto para instalar!
              </h2>
              <p className="text-muted-foreground mb-4">
                Clique no botão abaixo para adicionar o Skejool à sua tela inicial.
              </p>
              <Button onClick={promptInstall} className="w-full" size="lg">
                <Download className="w-5 h-5 mr-2" />
                Instalar Skejool
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 text-center">
                Como instalar no Android
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-medium">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Abra no Chrome</p>
                    <p className="text-sm text-muted-foreground">
                      Certifique-se de estar usando o navegador Chrome
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-medium">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Toque no menu (⋮)</p>
                    <p className="text-sm text-muted-foreground">
                      No canto superior direito do Chrome
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-medium">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      "Adicionar à tela inicial"
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Selecione esta opção e confirme
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Voltar ao Login
          </Link>
        </div>
      </main>
    </div>
  );
}
