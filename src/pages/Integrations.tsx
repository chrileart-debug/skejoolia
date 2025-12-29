import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
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
import { MessageSquare, Plus, Trash2, Phone, Link2, Unlink, Loader2, QrCode, Bot } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeLimitModal } from "@/components/subscription/UpgradeLimitModal";
import { z } from "zod";
import {
  WEBHOOK_ENDPOINTS,
  createWhatsAppInstance,
  connectWhatsAppInstance,
  checkWhatsAppStatus,
  disconnectWhatsAppInstance,
  deleteWhatsAppInstance,
} from "@/lib/webhook";

const WEBHOOK_URL = WEBHOOK_ENDPOINTS.WHATSAPP_INTEGRATION;
const POLLING_URL = WEBHOOK_ENDPOINTS.WHATSAPP_STATUS;
const QR_TIMEOUT_MS = 120000; // 2 minutes

// Validation schema
const integrationSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  numero: z.string().min(10, "Número deve ter pelo menos 10 dígitos"),
});

interface Integration {
  id: string;
  user_id: string;
  nome: string;
  numero: string;
  email: string | null;
  instancia: string | null;
  instance_id: string | null;
  status: string | null;
  vinculado_em: string | null;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id_agente: string;
  nome: string;
}

// Format phone number in Brazilian format: 55 11 99999-9999
const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 9) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  
  return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
};

// Remove formatting from phone number
const sanitizePhoneNumber = (value: string): string => {
  return value.replace(/\D/g, "");
};

// Generate instance name: {email_prefix}_{sanitized_number}
const generateInstanciaName = (email: string, numero: string): string => {
  const emailPrefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanNumero = sanitizePhoneNumber(numero);
  return `${emailPrefix}_${cleanNumero}`;
};

// Extract QR code from various response formats
const extractQRCode = (data: any): string | null => {
  // If it's a string starting with data:image
  if (typeof data === "string" && data.startsWith("data:image")) {
    return data;
  }
  
  // If it's a pure base64 string
  if (typeof data === "string" && data.length > 100) {
    return `data:image/png;base64,${data}`;
  }
  
  // If it's an array, get first element
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (first.qrcode) {
      return first.qrcode.startsWith("data:") ? first.qrcode : `data:image/png;base64,${first.qrcode}`;
    }
    if (first.base64) {
      return first.base64.startsWith("data:") ? first.base64 : `data:image/png;base64,${first.base64}`;
    }
  }
  
  // If it's an object with qrcode or base64 field
  if (data && typeof data === "object") {
    if (data.qrcode) {
      return data.qrcode.startsWith("data:") ? data.qrcode : `data:image/png;base64,${data.qrcode}`;
    }
    if (data.base64) {
      return data.base64.startsWith("data:") ? data.base64 : `data:image/png;base64,${data.base64}`;
    }
    if (data.qr_code) {
      return data.qr_code.startsWith("data:") ? data.qr_code : `data:image/png;base64,${data.qr_code}`;
    }
  }
  
  return null;
};

// Extract instance data from n8n response
const extractInstanceData = (data: any): { instanceId: string | null; instanceName: string | null } => {
  // If it's a string, use it as instanceName
  if (typeof data === "string") {
    return { instanceId: null, instanceName: data };
  }
  
  // If it's an array, get first element
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    return {
      instanceId: first.instance?.instanceId || first.instanceId || null,
      instanceName: first.instance?.instanceName || first.instanceName || null,
    };
  }
  
  // If it's an object
  if (data && typeof data === "object") {
    return {
      instanceId: data.instance?.instanceId || data.instanceId || null,
      instanceName: data.instance?.instanceName || data.instanceName || null,
    };
  }
  
  return { instanceId: null, instanceName: null };
};

// Check connection status from response
const isConnected = (data: any): boolean => {
  // String response
  if (typeof data === "string") {
    return data.toLowerCase() === "open" || data.toLowerCase() === "connected";
  }
  
  // Array response
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    const state = first.state || first.instance?.state || first.status;
    return state === "open" || state === "connected";
  }
  
  // Object response
  if (data && typeof data === "object") {
    const state = data.state || data.instance?.state || data.status;
    return state === "open" || state === "connected";
  }
  
  return false;
};

interface Barbershop {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
}

interface OutletContextType {
  onMenuClick: () => void;
  barbershop: Barbershop | null;
}

export default function Integrations() {
  const { onMenuClick, barbershop } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { checkLimit } = useSubscription();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
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
  const [countdown, setCountdown] = useState(120);
  const [formErrors, setFormErrors] = useState<{ nome?: string; numero?: string }>({});
  const [limitModal, setLimitModal] = useState<{ open: boolean; current: number; limit: number }>({
    open: false,
    current: 0,
    limit: 0,
  });
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTimeRef = useRef<number>(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    numero: "",
  });

  // Fetch integrations from Supabase
  const fetchIntegrations = useCallback(async () => {
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
  }, [user]);

  // Fetch agents to show which agent is linked
  const fetchAgents = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("agentes")
      .select("id_agente, nome");
    
    if (!error && data) {
      setAgents(data);
    }
  }, [user]);

  useEffect(() => {
    fetchIntegrations();
    fetchAgents();
  }, [fetchIntegrations, fetchAgents]);

  // Listen for whatsapp:updated events
  useEffect(() => {
    const handleUpdate = () => {
      fetchIntegrations();
      fetchAgents();
    };
    window.addEventListener("whatsapp:updated", handleUpdate);
    return () => window.removeEventListener("whatsapp:updated", handleUpdate);
  }, [fetchIntegrations, fetchAgents]);

  // Cleanup polling and countdown on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const resetForm = () => {
    setFormData({ nome: "", numero: "" });
    setFormErrors({});
  };

  const handleCreate = async () => {
    // Check limit using subscription system
    const limitResult = await checkLimit("whatsapp");
    if (!limitResult.allowed && !limitResult.unlimited) {
      setLimitModal({
        open: true,
        current: limitResult.current,
        limit: limitResult.limit,
      });
      return;
    }
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setFormData({ ...formData, numero: formatted });
    setFormErrors({ ...formErrors, numero: undefined });
  };

  const validateForm = (): boolean => {
    const cleanNumero = sanitizePhoneNumber(formData.numero);
    const result = integrationSchema.safeParse({
      nome: formData.nome,
      numero: cleanNumero,
    });

    if (!result.success) {
      const errors: { nome?: string; numero?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "nome") errors.nome = err.message;
        if (err.path[0] === "numero") errors.numero = err.message;
      });
      setFormErrors(errors);
      return false;
    }
    return true;
  };

  // 1. Create Integration
  const handleSubmitCreate = async () => {
    if (!validateForm()) return;
    
    if (!user?.email || !barbershop) {
      toast.error("Usuário não autenticado");
      return;
    }

    // Limit is already checked in handleCreate, but double-check here

    setIsCreating(true);
    const cleanNumero = sanitizePhoneNumber(formData.numero);
    let instancia = generateInstanciaName(user.email, cleanNumero);
    
    // Check if instance name already exists, add timestamp if needed
    const existing = integrations.find((i) => i.instancia === instancia);
    if (existing) {
      instancia = `${instancia}_${Date.now()}`;
    }

    try {
      // Call n8n webhook first to create instance
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "whatsapp.integration.create",
          instancia: instancia,
        }),
      });

      const webhookData = await response.json();
      console.log("Webhook create response:", webhookData);
      
      // Extract instance data from response
      const { instanceId, instanceName } = extractInstanceData(webhookData);
      const finalInstancia = instanceName || instancia;
      
      // Insert into Supabase
      const { data: insertedData, error: insertError } = await supabase
        .from("integracao_whatsapp")
        .insert({
          user_id: user.id,
          barbershop_id: barbershop.id,
          nome: formData.nome,
          numero: cleanNumero,
          email: user.email,
          instancia: finalInstancia,
          instance_id: instanceId,
          status: "pendente",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Dispatch global event
      window.dispatchEvent(new CustomEvent("whatsapp:updated"));
      
      toast.success("Integração criada com sucesso");
      fetchIntegrations();
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
    setCountdown(120);
    setIsQRDialogOpen(true);
    pollingStartTimeRef.current = Date.now();

    try {
      // Update status to "conectando"
      await supabase
        .from("integracao_whatsapp")
        .update({ status: "conectando" })
        .eq("id", integration.id);

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "whatsapp.integration.connect",
          instancia: integration.instancia,
        }),
      });

      const data = await response.json();
      console.log("Webhook connect response:", data);

      const qrCode = extractQRCode(data);
      
      if (qrCode) {
        setQrCodeData(qrCode);
        startCountdown();
        startSmartPolling(integration);
      } else {
        throw new Error("QR Code não recebido");
      }
    } catch (error: any) {
      console.error("Error connecting:", error);
      toast.error(error.message || "Erro ao conectar");
      setIsQRDialogOpen(false);
    } finally {
      setIsConnecting(false);
    }
  };

  // Start countdown timer
  const startCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 3. Smart Polling with 3 phases
  const startSmartPolling = (integration: Integration) => {
    if (pollingRef.current) clearTimeout(pollingRef.current);

    const poll = async () => {
      const elapsed = Date.now() - pollingStartTimeRef.current;
      
      // Stop after 2 minutes
      if (elapsed >= QR_TIMEOUT_MS) {
        clearTimeout(pollingRef.current!);
        pollingRef.current = null;
        
        await supabase
          .from("integracao_whatsapp")
          .update({ status: "desconectado" })
          .eq("id", integration.id);
        
        toast.error("Tempo esgotado. Tente conectar novamente.");
        setIsQRDialogOpen(false);
        fetchIntegrations();
        return;
      }

      try {
        const response = await fetch(POLLING_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instancia: integration.instancia,
          }),
        });

        const data = await response.json();
        console.log("Polling response:", data);

        if (isConnected(data)) {
          clearTimeout(pollingRef.current!);
          pollingRef.current = null;
          if (countdownRef.current) clearInterval(countdownRef.current);
          
          // Update status in Supabase
          await supabase
            .from("integracao_whatsapp")
            .update({ status: "conectado" })
            .eq("id", integration.id);

          window.dispatchEvent(new CustomEvent("whatsapp:updated"));
          toast.success("WhatsApp conectado com sucesso!");
          setIsQRDialogOpen(false);
          fetchIntegrations();
          return;
        }
      } catch (error) {
        console.error("Polling error:", error);
      }

      // Determine next polling interval based on elapsed time
      let nextInterval: number;
      if (elapsed < 10000) {
        // Phase 1: 0-10s, poll every 2s
        nextInterval = 2000;
      } else if (elapsed < 30000) {
        // Phase 2: 10-30s, poll every 3s
        nextInterval = 3000;
      } else {
        // Phase 3: 30s+, poll every 2s
        nextInterval = 2000;
      }

      pollingRef.current = setTimeout(poll, nextInterval);
    };

    // Start first poll after 2 seconds
    pollingRef.current = setTimeout(poll, 2000);
  };

  // 4. Disconnect
  const handleDisconnect = async (integration: Integration) => {
    setIsDisconnecting(true);

    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "whatsapp.integration.disconnect",
          instancia: integration.instancia,
        }),
      });

      // Update status in Supabase
      await supabase
        .from("integracao_whatsapp")
        .update({ status: "desconectado" })
        .eq("id", integration.id);

      window.dispatchEvent(new CustomEvent("whatsapp:updated"));
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
  const handleDeleteClick = async (integration: Integration) => {
    // Check if integration is being used by any agent
    const { data: linkedAgents } = await supabase
      .from("agentes")
      .select("id_agente")
      .eq("whatsapp_id", integration.id);

    if (linkedAgents && linkedAgents.length > 0) {
      toast.error("Esta integração está vinculada a um agente. Desvincule primeiro.");
      return;
    }

    setSelectedIntegration(integration);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedIntegration) return;

    setIsDeleting(true);

    try {
      // Send webhook to delete instance
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "whatsapp.integration.delete",
          instancia: selectedIntegration.instancia,
        }),
      });

      // Delete from Supabase
      const { error } = await supabase
        .from("integracao_whatsapp")
        .delete()
        .eq("id", selectedIntegration.id);

      if (error) throw error;

      window.dispatchEvent(new CustomEvent("whatsapp:updated"));
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
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setIsQRDialogOpen(false);
    setQrCodeData(null);
    setSelectedIntegration(null);
    setCountdown(120);
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

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getLinkedAgentName = (integrationId: string): string | null => {
    const integration = integrations.find(i => i.id === integrationId);
    if (!integration?.vinculado_em) return null;
    const agent = agents.find(a => a.id_agente === integration.vinculado_em);
    return agent?.nome || null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Integrações" subtitle="Gerencie suas conexões" onMenuClick={onMenuClick} />
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
        subtitle="Gerencie suas conexões"
        onMenuClick={onMenuClick}
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
            {integrations.map((integration) => {
              const linkedAgentName = getLinkedAgentName(integration.id);
              
              return (
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
                          {formatPhoneNumber(integration.numero)}
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

                  {/* Show linked agent */}
                  {linkedAgentName && (
                    <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-primary/5 border border-primary/10">
                      <Bot className="w-4 h-4 text-primary" />
                      <span className="text-sm text-foreground">
                        Vinculado a: <span className="font-medium">{linkedAgentName}</span>
                      </span>
                    </div>
                  )}

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
              );
            })}
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
                onChange={(e) => {
                  setFormData({ ...formData, nome: e.target.value });
                  setFormErrors({ ...formErrors, nome: undefined });
                }}
              />
              {formErrors.nome && (
                <p className="text-xs text-destructive">{formErrors.nome}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Número do WhatsApp *</Label>
              <Input
                placeholder="55 11 99999-9999"
                value={formData.numero}
                onChange={(e) => handlePhoneChange(e.target.value)}
              />
              {formErrors.numero ? (
                <p className="text-xs text-destructive">{formErrors.numero}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Com código do país (ex: 55 11 99999-9999)
                </p>
              )}
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
                  <p className="text-lg font-semibold text-primary mt-2">
                    {formatCountdown(countdown)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tempo restante
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

      {/* Upgrade Limit Modal */}
      <UpgradeLimitModal
        open={limitModal.open}
        onOpenChange={(open) => setLimitModal({ ...limitModal, open })}
        resourceType="whatsapp"
        currentCount={limitModal.current}
        limit={limitModal.limit}
      />
    </div>
  );
}
