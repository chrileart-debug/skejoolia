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
          client_id: string | null
          created_at: string
          end_time: string | null
          id_agendamento: string
          id_corte: string | null
          nome_cliente: string | null
          start_time: string
          status: string | null
          telefone_cliente: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          end_time?: string | null
          id_agendamento?: string
          id_corte?: string | null
          nome_cliente?: string | null
          start_time: string
          status?: string | null
          telefone_cliente?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          end_time?: string | null
          id_agendamento?: string
          id_corte?: string | null
          nome_cliente?: string | null
          start_time?: string
          status?: string | null
          telefone_cliente?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "agendamentos_id_corte_fkey"
            columns: ["id_corte"]
            isOneToOne: false
            referencedRelation: "cortes"
            referencedColumns: ["id_corte"]
          },
        ]
      }
      agentes: {
        Row: {
          ativo: boolean | null
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
      clientes: {
        Row: {
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
      cortes: {
        Row: {
          agente_pode_usar: boolean | null
          created_at: string
          descricao: string | null
          id_corte: string
          image_corte: string | null
          nome_corte: string
          preco_corte: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agente_pode_usar?: boolean | null
          created_at?: string
          descricao?: string | null
          id_corte?: string
          image_corte?: string | null
          nome_corte: string
          preco_corte?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agente_pode_usar?: boolean | null
          created_at?: string
          descricao?: string | null
          id_corte?: string
          image_corte?: string | null
          nome_corte?: string
          preco_corte?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integracao_whatsapp: {
        Row: {
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
        Relationships: []
      }
      memoria: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          nicho: string | null
          nome: string | null
          nome_empresa: string | null
          numero: string | null
          subnicho: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          nicho?: string | null
          nome?: string | null
          nome_empresa?: string | null
          numero?: string | null
          subnicho?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          nicho?: string | null
          nome?: string | null
          nome_empresa?: string | null
          numero?: string | null
          subnicho?: string | null
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
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
