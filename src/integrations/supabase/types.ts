export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          barbershop_id: string
          client_id: string | null
          created_at: string
          end_time: string | null
          id_agendamento: string
          nome_cliente: string | null
          service_id: string | null
          start_time: string
          status: string | null
          telefone_cliente: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barbershop_id: string
          client_id?: string | null
          created_at?: string
          end_time?: string | null
          id_agendamento?: string
          nome_cliente?: string | null
          service_id?: string | null
          start_time: string
          status?: string | null
          telefone_cliente?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barbershop_id?: string
          client_id?: string | null
          created_at?: string
          end_time?: string | null
          id_agendamento?: string
          nome_cliente?: string | null
          service_id?: string | null
          start_time?: string
          status?: string | null
          telefone_cliente?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["client_id"]
          },
        ]
      }
      agentes: {
        Row: {
          ativo: boolean | null
          barbershop_id: string
          created_at: string
          funcao: string | null
          horario_trabalho: Json | null
          id_agente: string
          limite_caracteres: number | null
          nome: string
          objetivo: string | null
          restricoes: string | null
          sexo: string | null
          tom_de_voz: string | null
          updated_at: string
          user_id: string
          whatsapp_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          barbershop_id: string
          created_at?: string
          funcao?: string | null
          horario_trabalho?: Json | null
          id_agente?: string
          limite_caracteres?: number | null
          nome: string
          objetivo?: string | null
          restricoes?: string | null
          sexo?: string | null
          tom_de_voz?: string | null
          updated_at?: string
          user_id: string
          whatsapp_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          barbershop_id?: string
          created_at?: string
          funcao?: string | null
          horario_trabalho?: Json | null
          id_agente?: string
          limite_caracteres?: number | null
          nome?: string
          objetivo?: string | null
          restricoes?: string | null
          sexo?: string | null
          tom_de_voz?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agentes_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agentes_whatsapp_id_fkey"
            columns: ["whatsapp_id"]
            isOneToOne: false
            referencedRelation: "agentes_integracoes_view"
            referencedColumns: ["integracao_id"]
          },
          {
            foreignKeyName: "agentes_whatsapp_id_fkey"
            columns: ["whatsapp_id"]
            isOneToOne: false
            referencedRelation: "integracao_whatsapp"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershops: {
        Row: {
          address: string | null
          asaas_customer_id: string | null
          cep: string | null
          city: string | null
          cpf_cnpj: string | null
          created_at: string
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          nicho: string | null
          owner_id: string
          phone: string | null
          slug: string | null
          state: string | null
          subnicho: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          asaas_customer_id?: string | null
          cep?: string | null
          city?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          nicho?: string | null
          owner_id: string
          phone?: string | null
          slug?: string | null
          state?: string | null
          subnicho?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          asaas_customer_id?: string | null
          cep?: string | null
          city?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          nicho?: string | null
          owner_id?: string
          phone?: string | null
          slug?: string | null
          state?: string | null
          subnicho?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          barbershop_id: string
          created_at: string
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          barbershop_id: string
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          barbershop_id?: string
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          agente_ativo: boolean
          barbershop_id: string
          client_id: string
          created_at: string
          faturamento_total: number | null
          id_agente: string | null
          nome: string | null
          telefone: string | null
          total_cortes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agente_ativo?: boolean
          barbershop_id: string
          client_id?: string
          created_at?: string
          faturamento_total?: number | null
          id_agente?: string | null
          nome?: string | null
          telefone?: string | null
          total_cortes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agente_ativo?: boolean
          barbershop_id?: string
          client_id?: string
          created_at?: string
          faturamento_total?: number | null
          id_agente?: string | null
          nome?: string | null
          telefone?: string | null
          total_cortes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_id_agente_fkey"
            columns: ["id_agente"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["id_agente"]
          },
          {
            foreignKeyName: "clientes_id_agente_fkey"
            columns: ["id_agente"]
            isOneToOne: false
            referencedRelation: "agentes_integracoes_view"
            referencedColumns: ["id_agente"]
          },
        ]
      }
      integracao_whatsapp: {
        Row: {
          barbershop_id: string
          created_at: string
          email: string | null
          id: string
          instance_id: string | null
          instancia: string | null
          nome: string
          numero: string
          status: string | null
          updated_at: string
          user_id: string
          vinculado_em: string | null
        }
        Insert: {
          barbershop_id: string
          created_at?: string
          email?: string | null
          id?: string
          instance_id?: string | null
          instancia?: string | null
          nome: string
          numero: string
          status?: string | null
          updated_at?: string
          user_id: string
          vinculado_em?: string | null
        }
        Update: {
          barbershop_id?: string
          created_at?: string
          email?: string | null
          id?: string
          instance_id?: string | null
          instancia?: string | null
          nome?: string
          numero?: string
          status?: string | null
          updated_at?: string
          user_id?: string
          vinculado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracao_whatsapp_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      memoria: {
        Row: {
          barbershop_id: string
          id: number
          message: Json
          session_id: string
          user_id: string | null
        }
        Insert: {
          barbershop_id: string
          id?: number
          message: Json
          session_id: string
          user_id?: string | null
        }
        Update: {
          barbershop_id?: string
          id?: number
          message?: Json
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memoria_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          barbershop_id: string
          created_at: string | null
          due_date: string | null
          id: string
          invoice_url: string | null
          method: string | null
          paid_at: string | null
          raw: Json | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          barbershop_id: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          method?: string | null
          paid_at?: string | null
          raw?: Json | null
          status: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          barbershop_id?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          method?: string | null
          paid_at?: string | null
          raw?: Json | null
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          max_agents: number
          max_appointments_month: number | null
          max_services: number | null
          max_whatsapp: number
          name: string
          price: number
          slug: string
          trial_days: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_agents: number
          max_appointments_month?: number | null
          max_services?: number | null
          max_whatsapp: number
          name: string
          price: number
          slug: string
          trial_days?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_agents?: number
          max_appointments_month?: number | null
          max_services?: number | null
          max_whatsapp?: number
          name?: string
          price?: number
          slug?: string
          trial_days?: number | null
        }
        Relationships: []
      }
      service_package_items: {
        Row: {
          created_at: string
          id: string
          package_id: string
          quantity: number | null
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          quantity?: number | null
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          quantity?: number | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_package_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          agent_enabled: boolean | null
          barbershop_id: string
          category_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_package: boolean | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          agent_enabled?: boolean | null
          barbershop_id: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_package?: boolean | null
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          agent_enabled?: boolean | null
          barbershop_id?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_package?: boolean | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      session_checkout: {
        Row: {
          asaas_checkout_id: string | null
          asaas_checkout_link: string | null
          barbershop_id: string
          created_at: string | null
          id: string
          plan_name: string | null
          plan_price: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asaas_checkout_id?: string | null
          asaas_checkout_link?: string | null
          barbershop_id: string
          created_at?: string | null
          id?: string
          plan_name?: string | null
          plan_price?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asaas_checkout_id?: string | null
          asaas_checkout_link?: string | null
          barbershop_id?: string
          created_at?: string | null
          id?: string
          plan_name?: string | null
          plan_price?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_checkout_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          asaas_subscription_id: string | null
          barbershop_id: string
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_slug: string
          price_at_signup: number | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_expires_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asaas_subscription_id?: string | null
          barbershop_id: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_slug: string
          price_at_signup?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asaas_subscription_id?: string | null
          barbershop_id?: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_slug?: string
          price_at_signup?: number | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_expires_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
        ]
      }
      user_barbershop_roles: {
        Row: {
          barbershop_id: string
          created_at: string
          id: string
          permissions: Json | null
          role: Database["public"]["Enums"]["barbershop_role"]
          status: string
          user_id: string
        }
        Insert: {
          barbershop_id: string
          created_at?: string
          id?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["barbershop_role"]
          status?: string
          user_id: string
        }
        Update: {
          barbershop_id?: string
          created_at?: string
          id?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["barbershop_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_barbershop_roles_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          email: string | null
          nome: string | null
          numero: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          nome?: string | null
          numero?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          nome?: string | null
          numero?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      agentes_integracoes_view: {
        Row: {
          agente_created_at: string | null
          agente_nome: string | null
          agente_updated_at: string | null
          ativo: boolean | null
          email: string | null
          funcao: string | null
          horario_trabalho: Json | null
          id_agente: string | null
          instance_id: string | null
          instancia: string | null
          integracao_created_at: string | null
          integracao_id: string | null
          integracao_nome: string | null
          integracao_status: string | null
          integracao_updated_at: string | null
          limite_caracteres: number | null
          numero: string | null
          objetivo: string | null
          restricoes: string | null
          sexo: string | null
          tom_de_voz: string | null
          user_id: string | null
          vinculado_em: string | null
          whatsapp_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agentes_whatsapp_id_fkey"
            columns: ["whatsapp_id"]
            isOneToOne: false
            referencedRelation: "agentes_integracoes_view"
            referencedColumns: ["integracao_id"]
          },
          {
            foreignKeyName: "agentes_whatsapp_id_fkey"
            columns: ["whatsapp_id"]
            isOneToOne: false
            referencedRelation: "integracao_whatsapp"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_team_member_status: { Args: never; Returns: undefined }
      check_user_limit: {
        Args: { p_resource: string; p_user_id: string }
        Returns: Json
      }
      expire_trials: { Args: never; Returns: number }
      get_available_integracoes_whatsapp: {
        Args: { p_current_agent_id?: string; p_user_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          instance_id: string
          instancia: string
          nome: string
          numero: string
          status: string
          updated_at: string
          user_id: string
          vinculado_em: string
        }[]
      }
      get_barbershop_team: {
        Args: { p_barbershop_id: string }
        Returns: {
          email: string
          name: string
          permissions: Json
          phone: string
          role: string
          role_id: string
          status: string
          user_id: string
        }[]
      }
      has_barbershop_role: {
        Args: {
          _barbershop_id: string
          _role?: Database["public"]["Enums"]["barbershop_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owner_can_view_user_settings: {
        Args: { _target_user_id: string }
        Returns: boolean
      }
      user_belongs_to_barbershop: {
        Args: { _barbershop_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      barbershop_role: "owner" | "staff"
      subscription_status:
        | "trialing"
        | "active"
        | "canceled"
        | "expired"
        | "past_due"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      barbershop_role: ["owner", "staff"],
      subscription_status: [
        "trialing",
        "active",
        "canceled",
        "expired",
        "past_due",
      ],
    },
  },
} as const
