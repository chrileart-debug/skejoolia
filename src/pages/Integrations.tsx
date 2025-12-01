import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { EmptyState } from "@/components/shared/EmptyState";
import { FAB } from "@/components/shared/FAB";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquare, Plus, Trash2, Phone, Link2, Unlink, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const WEBHOOK_URL = "https://webhook.lernow.com/webhook/integracao_whatsapp";
const POLLING_URL = "https://webhook.lernow.com/webhook/integracao_whatsapp_status";

interface Integration {
  id: string;
  user_id: string;
  nome: string;
  numero: string;
  email: string | null;
  instancia: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export default function Integrations() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingCountRef = useRef(0);
  
  const [formData, setFormData] = useState({
    nome: "",
    numero: "",
  });

  // Fetch integrations from Supabase
  const fetchIntegrations = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("integracao_whatsapp")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching integrations:", error);
      toast.error("Erro ao carregar integrações");
    } else {
      setIntegrations(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchIntegrations();
  }, [user]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const generateInstanciaName = (nome: string, numero: string, email: string) => {
    const cleanNome = nome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const cleanNumero = numero.replace(/\D/g, "");
    const cleanEmail = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    return `${cleanNome}-${cleanNumero}-${cleanEmail}`;
  };

  const resetForm = () => {
    setFormData({ nome: "", numero: "" });
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  // 1. Create Integration
  const handleSubmitCreate = async () => {
    if (!formData.nome || !formData.numero) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (!user?.email) {
      toast.error("Usuário não autenticado");
      return;
    }

    setIsCreating(true);
    const instancia = generateInstanciaName(formData.nome, formData.numero, user.email);

    try {
      // Insert into Supabase first
      const { data: insertedData, error: insertError } = await supabase
        .from("integracao_whatsapp")
        .insert({
          user_id: user.id,
          nome: formData.nome,
          numero: formData.numero,
          email: user.email,
          instancia: instancia,
          status: "pendente",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send webhook to create instance
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "whatsapp.integration.create",
          id_integracao: insertedData.id,
          user_id: user.id,
          instancia: instancia,
        }),
      });

      const webhookData = await response.json();
      console.log("Webhook create response:", webhookData);

      if (webhookData.success) {
        toast.success("Integração criada com sucesso");
        fetchIntegrations();
      } else {
        // If webhook fails, delete the record
        await supabase.from("integracao_whatsapp").delete().eq("id", insertedData.id);
        throw new Error(webhookData.message || "Erro ao criar instância");
      }
    } catch (error: any) {
      console.error("Error creating integration:", error);
      toast.error(error.message || "Erro ao criar integração");
    } finally {
      setIsCreating(false);
      setIsCreateDialogOpen(false);
      resetForm();
    }
  };

  // 2. Connect (QR Code)
  const handleConnect = async (integration: Integration) => {
    setSelectedIntegration(integration);
    setIsConnecting(true);
    setQrCodeData(null);
    setIsQRDialogOpen(true);
    pollingCountRef.current = 0;

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "whatsapp.integration.connect",
          id_integracao: integration.id,
          user_id: user?.id,
          instancia: integration.instancia,
        }),
      });

      const data = await response.json();
      console.log("Webhook connect response:", data);

      if (data.success && data.qr_code) {
        setQrCodeData(data.qr_code);
        
        // Update status to "conectando"
        await supabase
          .from("integracao_whatsapp")
          .update({ status: "conectando" })
          .eq("id", integration.id);

        // Start polling
        startPolling(integration);
      } else {
        throw new Error(data.message || "Erro ao gerar QR Code");
      }
    } catch (error: any) {
      console.error("Error connecting:", error);
      toast.error(error.message || "Erro ao conectar");
      setIsQRDialogOpen(false);
    } finally {
      setIsConnecting(false);
    }
  };

  // 3. Polling for connection status
  const startPolling = (integration: Integration) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      pollingCountRef.current += 1;
      
      // Stop after ~2 minutes (4 polls at 30s each)
      if (pollingCountRef.current > 4) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        toast.error("Tempo esgotado. Tente conectar novamente.");
        setIsQRDialogOpen(false);
        return;
      }

      try {
        const response = await fetch(POLLING_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_integracao: integration.id,
            user_id: user?.id,
            instancia: integration.instancia,
          }),
        });

        const data = await response.json();
        console.log("Polling response:", data);

        if (data.success && data.status === "conectado") {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          
          // Update status in Supabase
          await supabase
            .from("integracao_whatsapp")
            .update({ status: "conectado" })
            .eq("id", integration.id);

          toast.success("WhatsApp conectado com sucesso!");
          setIsQRDialogOpen(false);
          fetchIntegrations();
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 30000); // 30 seconds
  };

  // 4. Disconnect
  const handleDisconnect = async (integration: Integration) => {
    setIsDisconnecting(true);

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "whatsapp.integration.disconnect",
          id_integracao: integration.id,
          user_id: user?.id,
          instancia: integration.instancia,
        }),
      });

      const data = await response.json();
      console.log("Webhook disconnect response:", data);

      // Update status in Supabase
      await supabase
        .from("integracao_whatsapp")
        .update({ status: "desconectado" })
        .eq("id", integration.id);

      toast.success("WhatsApp desconectado");
      fetchIntegrations();
    } catch (error: any) {
      console.error("Error disconnecting:", error);
      toast.error("Erro ao desconectar");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // 5. Delete
  const handleDeleteClick = (integration: Integration) => {
    setSelectedIntegration(integration);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedIntegration) return;

    setIsDeleting(true);

    try {
      // Send webhook to delete instance
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "whatsapp.integration.delete",
          id_integracao: selectedIntegration.id,
          instancia: selectedIntegration.instancia,
        }),
      });

      const data = await response.json();
      console.log("Webhook delete response:", data);

      // Delete from Supabase
      const { error } = await supabase
        .from("integracao_whatsapp")
        .delete()
        .eq("id", selectedIntegration.id);

      if (error) throw error;

      toast.success("Integração excluída com sucesso");
      fetchIntegrations();
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir integração");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setSelectedIntegration(null);
    }
  };

  const handleCloseQRDialog = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsQRDialogOpen(false);
    setQrCodeData(null);
    setSelectedIntegration(null);
  };

  const getStatusForBadge = (status: string | null): "online" | "offline" | "pending" => {
    if (status === "conectado") return "online";
    if (status === "conectando" || status === "pendente") return "pending";
    return "offline";
  };

  const getStatusLabel = (status: string | null): string => {
    switch (status) {
      case "conectado": return "Conectado";
      case "conectando": return "Conectando...";
      case "pendente": return "Pendente";
      case "desconectado": return "Desconectado";
      default: return "Offline";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Integrações" subtitle="Gerencie suas conexões com WhatsApp" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Integrações"
        subtitle="Gerencie suas conexões com WhatsApp"
      />

      <div className="p-4 lg:p-6">
        {integrations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-10 h-10 text-muted-foreground" />}
            title="Nenhuma integração configurada"
            description="Conecte seu WhatsApp para começar a receber agendamentos automaticamente."
            action={
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Integração
              </Button>
            }
            className="min-h-[60vh]"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="bg-card rounded-2xl shadow-card p-5 hover:shadow-card-hover transition-all duration-300 animate-fade-in"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        integration.status === "conectado"
                          ? "bg-success/10"
                          : "bg-muted"
                      }`}
                    >
                      <MessageSquare
                        className={`w-6 h-6 ${
                          integration.status === "conectado"
                            ? "text-success"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {integration.nome}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        {integration.numero}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <StatusBadge status={getStatusForBadge(integration.status)} />
                  <span className="text-xs text-muted-foreground">
                    {getStatusLabel(integration.status)}
                  </span>
                </div>

                <div className="flex gap-2">
                  {integration.status === "conectado" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDisconnect(integration)}
                      disabled={isDisconnecting}
                    >
                      <Unlink className="w-4 h-4 mr-1" />
                      Desconectar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleConnect(integration)}
                      disabled={isConnecting}
                    >
                      <Link2 className="w-4 h-4 mr-1" />
                      Conectar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteClick(integration)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {integrations.length > 0 && (
        <FAB onClick={handleCreate} label="Nova Integração" />
      )}

      {/* Create Integration Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Integração</DialogTitle>
            <DialogDescription>
              Adicione um novo número de WhatsApp para integrar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome de identificação *</Label>
              <Input
                placeholder="Ex: WhatsApp Principal"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Número do WhatsApp *</Label>
              <Input
                placeholder="5511999999999"
                value={formData.numero}
                onChange={(e) =>
                  setFormData({ ...formData, numero: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Apenas números, com código do país (ex: 5511999999999)
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSubmitCreate}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Adicionar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={isQRDialogOpen} onOpenChange={handleCloseQRDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-6">
            {isConnecting ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : qrCodeData ? (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-xl">
                  <img 
                    src={qrCodeData} 
                    alt="QR Code WhatsApp" 
                    className="w-64 h-64"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Aguardando conexão...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O QR Code expira em 2 minutos
                  </p>
                </div>
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-destructive">Erro ao gerar QR Code</p>
                <Button onClick={() => selectedIntegration && handleConnect(selectedIntegration)}>
                  Tentar Novamente
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Integração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a integração "{selectedIntegration?.nome}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
