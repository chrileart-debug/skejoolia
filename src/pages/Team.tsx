import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Users, Mail, UserPlus, Crown, Shield, Loader2, Trash2, User, Phone, Pencil, Clock, CheckCircle2, RefreshCw, Settings2, Percent } from "lucide-react";
import { useSetPageHeader } from "@/contexts/PageHeaderContext";
import { StaffConfigSheet } from "@/components/staff/StaffConfigSheet";
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
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { FAB } from "@/components/shared/FAB";
import { EmptyState } from "@/components/shared/EmptyState";

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

export interface Permissions {
  can_view_dashboard: boolean;
  can_manage_agents: boolean;
  can_manage_schedule: boolean;
  can_view_clients: boolean;
  can_manage_services: boolean;
}

interface TeamMember {
  role_id: string;
  user_id: string;
  role: "owner" | "staff";
  permissions: Permissions | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: "active" | "pending";
  commission_percentage: number | null;
}

type OutletContextType = {
  onMenuClick: () => void;
  barbershop: Barbershop | null;
  barbershopSlug: string | null;
  isOwner: boolean;
};

const DEFAULT_PERMISSIONS: Permissions = {
  can_view_dashboard: false,
  can_manage_agents: false,
  can_manage_schedule: true,
  can_view_clients: true,
  can_manage_services: false,
};

export default function Team() {
  const { onMenuClick, barbershop, barbershopSlug, isOwner } = useOutletContext<OutletContextType>();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  
  useSetPageHeader("Equipe", "Gerencie os membros da sua barbearia");
  
  // Check if user is on basico plan (solo barber mode)
  const isBasicoPlan = subscription?.plan_slug === "basico";
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
  
  // Config sheet state
  const [configSheetOpen, setConfigSheetOpen] = useState(false);
  const [configMember, setConfigMember] = useState<TeamMember | null>(null);
  
  // Commission state
  const [savingCommission, setSavingCommission] = useState<string | null>(null);

  const handleOpenConfig = (member: TeamMember) => {
    setConfigMember(member);
    setConfigSheetOpen(true);
  };

  const handleUpdateCommission = async (userId: string, roleId: string, value: number | null) => {
    if (!barbershop?.id) return;
    
    setSavingCommission(userId);
    try {
      const { error } = await supabase
        .from("user_barbershop_roles")
        .update({ commission_percentage: value })
        .eq("id", roleId)
        .eq("barbershop_id", barbershop.id);

      if (error) throw error;

      // Update local state
      setTeamMembers(prev => 
        prev.map(m => m.user_id === userId ? { ...m, commission_percentage: value } : m)
      );
      
      toast.success("Comissão atualizada");
    } catch (error) {
      console.error("Error updating commission:", error);
      toast.error("Erro ao atualizar comissão");
    } finally {
      setSavingCommission(null);
    }
  };

  useEffect(() => {
    if (barbershop?.id) {
      fetchTeamMembers();
    }
  }, [barbershop?.id]);

  const fetchTeamMembers = async () => {
    if (!barbershop?.id) return;

    try {
      const { data, error } = await supabase
        .rpc("get_barbershop_team", { p_barbershop_id: barbershop.id });

      if (error) throw error;

      // Fetch commission percentages from user_barbershop_roles
      const userIds = (data || []).map((m: any) => m.user_id);
      let commissionMap: Record<string, number | null> = {};
      
      if (userIds.length > 0) {
        const { data: rolesData } = await supabase
          .from("user_barbershop_roles")
          .select("user_id, commission_percentage")
          .eq("barbershop_id", barbershop.id)
          .in("user_id", userIds);
        
        if (rolesData) {
          rolesData.forEach((r: any) => {
            commissionMap[r.user_id] = r.commission_percentage;
          });
        }
      }

      const members: TeamMember[] = (data || []).map((m: any) => ({
        role_id: m.role_id,
        user_id: m.user_id,
        role: m.role as "owner" | "staff",
        permissions: m.permissions as Permissions | null,
        name: m.name,
        email: m.email,
        phone: m.phone,
        status: m.status as "active" | "pending",
        commission_percentage: commissionMap[m.user_id] ?? null,
      }));

      setTeamMembers(members);
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
        .eq("id", editingMember.role_id)
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
    if (!barbershop?.id || !member.email) return;

    setResendingUserId(member.user_id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke("invite-user", {
        body: {
          email: member.email,
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

      toast.success(`Convite reenviado para ${member.email}`);
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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="perm-services"
            checked={permissions.can_manage_services}
            onCheckedChange={(checked) => 
              onChange({ ...permissions, can_manage_services: !!checked })
            }
          />
          <Label htmlFor="perm-services" className="text-sm font-normal cursor-pointer">
            Gerenciar Serviços
          </Label>
        </div>
      </div>
    </div>
  );

  // Filter team members: staff only sees themselves
  const displayMembers = isOwner 
    ? teamMembers 
    : teamMembers.filter(m => m.user_id === user?.id);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">

      {/* Team Members List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : displayMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10 text-muted-foreground" />}
          title="Nenhum membro na equipe"
          description={isBasicoPlan ? "Configure seu perfil profissional" : (isOwner ? "Convide membros para sua equipe" : "Você ainda não foi configurado")}
          action={
            !isBasicoPlan && isOwner ? (
              <Button onClick={() => setInviteModalOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Convidar Membro
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {displayMembers.map((member) => (
            <Card key={member.role_id}>
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
                          {member.name || "Sem nome"}
                        </p>
                        <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                          {member.role === "owner" ? "Proprietário" : "Funcionário"}
                        </Badge>
                        {/* Status Badge */}
                        {member.role === "staff" && (
                          member.status === "active" ? (
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
                          {member.email || "Email não informado"}
                        </span>
                        {member.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {member.phone}
                          </span>
                        )}
                        {/* Commission Badge - Only show for staff or service providers */}
                        {isOwner && member.status === "active" && member.role === "staff" && (
                          <div className="flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="--"
                              value={member.commission_percentage ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : Number(e.target.value);
                                handleUpdateCommission(member.user_id, member.role_id, val);
                              }}
                              disabled={savingCommission === member.user_id}
                              className="w-12 h-6 px-1 text-xs text-center border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-xs">%</span>
                          </div>
                        )}
                        {!isOwner && member.commission_percentage !== null && (
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <Percent className="w-3 h-3" />
                            {member.commission_percentage}% comissão
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Config button for owner on basico plan (self-config) */}
                    {isBasicoPlan && member.role === "owner" && member.user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => handleOpenConfig(member)}
                        title="Configurar especialidades e horários"
                      >
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Config button for owner on corporativo plan (optional service provider) */}
                    {!isBasicoPlan && member.role === "owner" && member.user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => handleOpenConfig(member)}
                        title="Configurar como profissional"
                      >
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    )}
                    
                    {/* Config button for staff viewing themselves */}
                    {!isOwner && member.user_id === user?.id && member.status === "active" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => handleOpenConfig(member)}
                        title="Configurar serviços e horários"
                      >
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Actions for staff members (owner only) */}
                    {isOwner && member.user_id !== user?.id && !isBasicoPlan && (
                      <>
                        {/* Config button - for active members */}
                        {member.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => handleOpenConfig(member)}
                            title="Configurar especialidades e horários"
                          >
                            <Settings2 className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {/* Resend invite button - only for pending staff members */}
                        {member.role === "staff" && member.status === "pending" && (
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
                        
                        {/* Edit permissions - only for staff */}
                        {member.role === "staff" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => handleEditMember(member)}
                            title="Editar permissões"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {/* Delete - only for staff */}
                        {member.role === "staff" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteMemberId(member.role_id)}
                            title="Remover da equipe"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* FAB - only show for corporativo plan and for owners */}
      {isOwner && displayMembers.length > 0 && !isBasicoPlan && (
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
              Defina o que {editingMember?.name || "este membro"} pode acessar
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

      {/* Staff Config Sheet */}
      <StaffConfigSheet
        open={configSheetOpen}
        onOpenChange={setConfigSheetOpen}
        staffMember={configMember}
        barbershopId={barbershop?.id || ""}
        isOwner={isOwner}
        isBasicoPlan={isBasicoPlan}
      />
    </div>
  );
}
