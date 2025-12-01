import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Scissors,
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  User,
} from "lucide-react";

const upcomingAppointments = [
  {
    id: 1,
    client: "Carlos Silva",
    service: "Corte + Barba",
    time: "14:00",
    status: "confirmed" as const,
  },
  {
    id: 2,
    client: "Pedro Santos",
    service: "Corte Degradê",
    time: "15:00",
    status: "pending" as const,
  },
  {
    id: 3,
    client: "Lucas Oliveira",
    service: "Barba",
    time: "16:30",
    status: "confirmed" as const,
  },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        subtitle="Visão geral da sua barbearia"
      />

      <div className="p-4 lg:p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Cortes hoje"
            value="12"
            icon={<Scissors className="w-5 h-5" />}
            trend={{ value: 15, isPositive: true }}
          />
          <StatCard
            title="Faturamento diário"
            value="R$ 540"
            icon={<DollarSign className="w-5 h-5" />}
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title="Faturamento semanal"
            value="R$ 2.850"
            icon={<TrendingUp className="w-5 h-5" />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Agendamentos"
            value="8"
            icon={<Calendar className="w-5 h-5" />}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upcoming Appointments */}
          <div className="lg:col-span-2 bg-card rounded-2xl shadow-card p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">
                Próximos agendamentos
              </h2>
              <a
                href="/schedule"
                className="text-sm text-primary font-medium hover:underline"
              >
                Ver todos
              </a>
            </div>

            <div className="space-y-3">
              {upcomingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {appointment.client}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.service}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {appointment.time}
                      </div>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions / Next Appointment Card */}
          <div className="space-y-4">
            {/* Next Appointment */}
            <div className="bg-card rounded-2xl shadow-card p-5 animate-slide-up">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Próximo cliente
              </h3>
              <div className="gradient-primary rounded-xl p-4 text-primary-foreground">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold">Carlos Silva</p>
                    <p className="text-sm opacity-90">Corte + Barba</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>14:00 - em 30 minutos</span>
                </div>
              </div>
            </div>

            {/* WhatsApp Status */}
            <div className="bg-card rounded-2xl shadow-card p-5 animate-slide-up">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Status do Agente IA
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-success animate-pulse-soft" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Ativo</p>
                    <p className="text-sm text-muted-foreground">
                      3 conversas hoje
                    </p>
                  </div>
                </div>
                <StatusBadge status="online" />
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-card rounded-2xl shadow-card p-5 animate-slide-up">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Resumo do mês
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total de cortes</span>
                  <span className="font-semibold text-foreground">187</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Faturamento</span>
                  <span className="font-semibold text-foreground">R$ 8.420</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ticket médio</span>
                  <span className="font-semibold text-foreground">R$ 45,00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
