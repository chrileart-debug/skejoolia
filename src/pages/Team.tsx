import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Users, Mail, UserPlus, Crown, Shield, Loader2, Trash2, User, Phone, Pencil, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Json } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop, Permissions } from "@/hooks/useBarbershop";
import { useAuth } from "@/hooks/useAuth";
import { FAB } from "@/components/shared/FAB";
import { EmptyState } from "@/components/shared/EmptyState";

interface TeamMember {
  id: string;
  user_id: string;
  role: "owner" | "staff";
  created_at: string;
  permissions: Permissions | null;
  user_settings: {
    nome: string | null;
    email: string | null;
    numero: string | null;
  } | null;
  // For checking invite status
  confirmed_at: string | null;
}

type OutletContextType = {
  onMenuClick: () => void;
};

const DEFAULT_PERMISSIONS: Permissions = {
  can_view_dashboard: false,
  can_manage_agents: false,
  can_manage_schedule: true,
  can_view_clients: true,
};

export default function Team() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { barbershop, isOwner } = useBarbershop();
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [invitePermissions, setInvitePermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [inviting, setInviting] = useState(false);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editPermissions, setEditPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [saving, setSaving] = useState(false);
  
  // Delete state
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Resend invite state
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (barbershop?.id) {
      fetchTeamMembers();
    }
  }, [barbershop?.id]);

  const fetchTeamMembers = async () => {
    if (!barbershop?.id) return;

    try {
      // Get roles with permissions
      const { data: roles, error: rolesError } = await supabase
        .from("user_barbershop_roles")
        .select("id, user_id, role, created_at, permissions")
        .eq("barbershop_id", barbershop.id);

      if (rolesError) throw rolesError;

      // Get user settings and auth status for each member
      const membersWithSettings = await Promise.all(
        (roles || []).map(async (role) => {
          const { data: settings } = await supabase
            .from("user_settings")
            .select("nome, email, numero")
            .eq("user_id", role.user_id)
            .single();

          // Check auth status via user email confirmation
          // We'll use created_at as a proxy - if user_settings has email, user exists
          const confirmed = settings?.email ? true : false;

          return {
            ...role,
            permissions: role.permissions as unknown as Permissions | null,
            user_settings: settings,
            confirmed_at: confirmed ? role.created_at : null
          };
        })
      );

      setTeamMembers(membersWithSettings);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast.error("Erro ao carregar equipe");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim() || !barbershop?.id) return;

    setInviting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          phone: invitePhone.trim() || null,
          barbershop_id: barbershop.id,
          permissions: invitePermissions
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao enviar convite");
      }

      const data = response.data;
      
      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(data.existing_user 
        ? "Membro adicionado à equipe!" 
        : `Convite enviado para ${inviteEmail}`
      );
      resetInviteForm();
      setInviteModalOpen(false);
      fetchTeamMembers();
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast.error(error.message || "Erro ao enviar convite");
    } finally {
      setInviting(false);
    }
  };

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteName("");
    setInvitePhone("");
    setInvitePermissions(DEFAULT_PERMISSIONS);
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setEditPermissions(member.permissions || DEFAULT_PERMISSIONS);
    setEditModalOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!editingMember || !barbershop?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_barbershop_roles")
        .update({ permissions: editPermissions as unknown as Json })
        .eq("id", editingMember.id)
        .eq("barbershop_id", barbershop.id);

      if (error) throw error;

      toast.success("Permissões atualizadas");
      setEditModalOpen(false);
      setEditingMember(null);
      fetchTeamMembers();
    } catch (error) {
      console.error("Error updating permissions:", error);
      toast.error("Erro ao atualizar permissões");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!deleteMemberId || !barbershop?.id) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("user_barbershop_roles")
        .delete()
        .eq("id", deleteMemberId)
        .eq("barbershop_id", barbershop.id);

      if (error) throw error;

      toast.success("Membro removido da equipe");
      setDeleteMemberId(null);
      fetchTeamMembers();
    } catch (error) {
      console.error("Error removing team member:", error);
      toast.error("Erro ao remover membro");
    } finally {
      setDeleting(false);
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    if (!barbershop?.id || !member.user_settings?.email) return;

    setResendingUserId(member.user_id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke("invite-user", {
        body: {
          email: member.user_settings.email,
          barbershop_id: barbershop.id,
          resend: true
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao reenviar convite");
      }

      const data = response.data;
      
      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(`Convite reenviado para ${member.user_settings.email}`);
    } catch (error: any) {
      console.error("Error resending invite:", error);
      toast.error(error.message || "Erro ao reenviar convite");
    } finally {
      setResendingUserId(null);
    }
  };

  const PermissionCheckboxes = ({
    permissions, 
    onChange 
  }: { 
    permissions: Permissions; 
    onChange: (p: Permissions) => void;
  }) => (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Permissões de Acesso</Label>
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="perm-dashboard"
            checked={permissions.can_view_dashboard}
            onCheckedChange={(checked) => 
              onChange({ ...permissions, can_view_dashboard: !!checked })
            }
          />
          <Label htmlFor="perm-dashboard" className="text-sm font-normal cursor-pointer">
            Acessar Dashboard
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="perm-agents"
            checked={permissions.can_manage_agents}
            onCheckedChange={(checked) => 
              onChange({ ...permissions, can_manage_agents: !!checked })
            }
          />
          <Label htmlFor="perm-agents" className="text-sm font-normal cursor-pointer">
            Gerenciar Agentes IA
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="perm-schedule"
            checked={permissions.can_manage_schedule}
            onCheckedChange={(checked) => 
              onChange({ ...permissions, can_manage_schedule: !!checked })
            }
          />
          <Label htmlFor="perm-schedule" className="text-sm font-normal cursor-pointer">
            Gerenciar Agenda
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="perm-clients"
            checked={permissions.can_view_clients}
            onCheckedChange={(checked) => 
              onChange({ ...permissions, can_view_clients: !!checked })
            }
          />
          <Label htmlFor="perm-clients" className="text-sm font-normal cursor-pointer">
            Ver Clientes
          </Label>
        </div>
      </div>
    </div>
  );

  if (!isOwner) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <EmptyState
          icon={<Users className="w-10 h-10 text-muted-foreground" />}
          title="Acesso Restrito"
          description="Apenas proprietários podem gerenciar a equipe."
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
        <p className="text-muted-foreground">
          Gerencie os membros da sua barbearia
        </p>
      </div>

      {/* Team Members List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : teamMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10 text-muted-foreground" />}
          title="Nenhum membro na equipe"
          description="Convide membros para sua equipe"
          action={
            <Button onClick={() => setInviteModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Convidar Membro
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {teamMembers.map((member) => (
            <Card key={member.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {member.role === "owner" ? (
                        <Crown className="w-5 h-5 text-primary" />
                      ) : (
                        <Shield className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">
                          {member.user_settings?.nome || "Sem nome"}
                        </p>
                        <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                          {member.role === "owner" ? "Proprietário" : "Funcionário"}
                        </Badge>
                        {/* Status Badge */}
                        {member.role === "staff" && (
                          member.confirmed_at ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              <Clock className="w-3 h-3 mr-1" />
                              Pendente
                            </Badge>
                          )
                        )}
                        {member.user_id === user?.id && (
                          <Badge variant="outline">Você</Badge>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {member.user_settings?.email || "Email não informado"}
                        </span>
                        {member.user_settings?.numero && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {member.user_settings.numero}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions for staff members */}
                  {member.role === "staff" && member.user_id !== user?.id && (
                    <div className="flex items-center gap-1">
                      {/* Resend invite button - only for pending members */}
                      {!member.confirmed_at && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary"
                          onClick={() => handleResendInvite(member)}
                          disabled={resendingUserId === member.user_id}
                          title="Reenviar convite"
                        >
                          {resendingUserId === member.user_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => handleEditMember(member)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteMemberId(member.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* FAB */}
      {teamMembers.length > 0 && (
        <FAB onClick={() => setInviteModalOpen(true)} />
      )}

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={(open) => {
        setInviteModalOpen(open);
        if (!open) resetInviteForm();
      }}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
            <DialogDescription>
              Envie um convite por email para adicionar um novo membro à equipe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nome *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="invite-name"
                  type="text"
                  placeholder="Nome do membro"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-phone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="invite-phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Permissions */}
            <PermissionCheckboxes 
              permissions={invitePermissions} 
              onChange={setInvitePermissions} 
            />

            <Button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || !inviteName.trim() || inviting}
              className="w-full"
            >
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Enviar Convite
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Modal */}
      <Dialog open={editModalOpen} onOpenChange={(open) => {
        setEditModalOpen(open);
        if (!open) setEditingMember(null);
      }}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Permissões</DialogTitle>
            <DialogDescription>
              Defina o que {editingMember?.user_settings?.nome || "este membro"} pode acessar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <PermissionCheckboxes 
              permissions={editPermissions} 
              onChange={setEditPermissions} 
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSavePermissions}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteMemberId} onOpenChange={() => setDeleteMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover o membro da equipe. Ele perderá o acesso à barbearia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
