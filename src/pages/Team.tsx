import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Users, Mail, UserPlus, Crown, Shield, Loader2, Trash2, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useBarbershop } from "@/hooks/useBarbershop";
import { useAuth } from "@/hooks/useAuth";
import { FAB } from "@/components/shared/FAB";
import { EmptyState } from "@/components/shared/EmptyState";

interface TeamMember {
  id: string;
  user_id: string;
  role: "owner" | "staff";
  created_at: string;
  user_settings: {
    nome: string | null;
    email: string | null;
    numero: string | null;
  } | null;
}

type OutletContextType = {
  onMenuClick: () => void;
};

export default function Team() {
  const { onMenuClick } = useOutletContext<OutletContextType>();
  const { barbershop, isOwner } = useBarbershop();
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviting, setInviting] = useState(false);
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (barbershop?.id) {
      fetchTeamMembers();
    }
  }, [barbershop?.id]);

  const fetchTeamMembers = async () => {
    if (!barbershop?.id) return;

    try {
      // First get the roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_barbershop_roles")
        .select("id, user_id, role, created_at")
        .eq("barbershop_id", barbershop.id);

      if (rolesError) throw rolesError;

      // Then get user settings for each member
      const membersWithSettings = await Promise.all(
        (roles || []).map(async (role) => {
          const { data: settings } = await supabase
            .from("user_settings")
            .select("nome, email, numero")
            .eq("user_id", role.user_id)
            .single();

          return {
            ...role,
            user_settings: settings
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
          barbershop_id: barbershop.id
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
      setInviteEmail("");
      setInviteName("");
      setInvitePhone("");
      setInviteModalOpen(false);
      fetchTeamMembers();
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast.error(error.message || "Erro ao enviar convite");
    } finally {
      setInviting(false);
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {member.user_settings?.nome || "Sem nome"}
                        </p>
                        <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                          {member.role === "owner" ? "Proprietário" : "Funcionário"}
                        </Badge>
                        {member.user_id === user?.id && (
                          <Badge variant="outline">Você</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.user_settings?.email || "Email não informado"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Only show delete for staff members, not owners or self */}
                  {member.role === "staff" && member.user_id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteMemberId(member.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
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
