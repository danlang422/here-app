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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance_events: {
        Row: {
          created_at: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          location: Json | null
          location_verified: boolean | null
          section_id: string
          student_id: string
          timestamp: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          location?: Json | null
          location_verified?: boolean | null
          section_id: string
          student_id: string
          timestamp?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          location?: Json | null
          location_verified?: boolean | null
          section_id?: string
          student_id?: string
          timestamp?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections_with_enrollment_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          created_at: string | null
          date: string
          id: string
          marked_by: string
          notes: string | null
          section_id: string
          status: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          marked_by: string
          notes?: string | null
          section_id: string
          status: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          marked_by?: string
          notes?: string | null
          section_id?: string
          status?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections_with_enrollment_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_days: {
        Row: {
          ab_designation: Database["public"]["Enums"]["ab_designation"] | null
          created_at: string | null
          date: string
          id: string
          is_school_day: boolean
          notes: string | null
        }
        Insert: {
          ab_designation?: Database["public"]["Enums"]["ab_designation"] | null
          created_at?: string | null
          date: string
          id?: string
          is_school_day?: boolean
          notes?: string | null
        }
        Update: {
          ab_designation?: Database["public"]["Enums"]["ab_designation"] | null
          created_at?: string | null
          date?: string
          id?: string
          is_school_day?: boolean
          notes?: string | null
        }
        Relationships: []
      }
      interactions: {
        Row: {
          attendance_event_id: string | null
          author_id: string
          author_role: Database["public"]["Enums"]["role_name"]
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          prompt_id: string | null
          section_id: string | null
          type: Database["public"]["Enums"]["interaction_type"]
          updated_at: string | null
        }
        Insert: {
          attendance_event_id?: string | null
          author_id: string
          author_role: Database["public"]["Enums"]["role_name"]
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          prompt_id?: string | null
          section_id?: string | null
          type: Database["public"]["Enums"]["interaction_type"]
          updated_at?: string | null
        }
        Update: {
          attendance_event_id?: string | null
          author_id?: string
          author_role?: Database["public"]["Enums"]["role_name"]
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          prompt_id?: string | null
          section_id?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_attendance_event_id_fkey"
            columns: ["attendance_event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections_with_enrollment_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_opportunities: {
        Row: {
          available_slots: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          geofence_radius: number | null
          id: string
          is_active: boolean | null
          location: Json | null
          mentor_id: string | null
          name: string
          organization_name: string
          requirements: string | null
          updated_at: string | null
        }
        Insert: {
          available_slots?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          geofence_radius?: number | null
          id?: string
          is_active?: boolean | null
          location?: Json | null
          mentor_id?: string | null
          name: string
          organization_name: string
          requirements?: string | null
          updated_at?: string | null
        }
        Update: {
          available_slots?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          geofence_radius?: number | null
          id?: string
          is_active?: boolean | null
          location?: Json | null
          mentor_id?: string | null
          name?: string
          organization_name?: string
          requirements?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internship_opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_opportunities_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          trigger_event: Database["public"]["Enums"]["prompt_trigger"]
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          trigger_event: Database["public"]["Enums"]["prompt_trigger"]
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          trigger_event?: Database["public"]["Enums"]["prompt_trigger"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: Database["public"]["Enums"]["role_name"]
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: Database["public"]["Enums"]["role_name"]
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: Database["public"]["Enums"]["role_name"]
        }
        Relationships: []
      }
      section_students: {
        Row: {
          active: boolean | null
          created_at: string | null
          enrolled_at: string | null
          id: string
          section_id: string
          student_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          enrolled_at?: string | null
          id?: string
          section_id: string
          student_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          enrolled_at?: string | null
          id?: string
          section_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_students_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_students_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections_with_enrollment_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      section_teachers: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          section_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          section_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          section_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_teachers_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_teachers_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections_with_enrollment_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          attendance_enabled: boolean | null
          created_at: string | null
          created_by: string | null
          days_of_week: Json | null
          end_time: string
          expected_location: Json | null
          geofence_radius: number | null
          id: string
          internship_opportunity_id: string | null
          name: string
          parent_section_id: string | null
          presence_enabled: boolean | null
          presence_mood_enabled: boolean | null
          schedule_pattern: Database["public"]["Enums"]["schedule_pattern"]
          sis_block: number | null
          start_time: string
          type: Database["public"]["Enums"]["section_type"]
          updated_at: string | null
        }
        Insert: {
          attendance_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          days_of_week?: Json | null
          end_time: string
          expected_location?: Json | null
          geofence_radius?: number | null
          id?: string
          internship_opportunity_id?: string | null
          name: string
          parent_section_id?: string | null
          presence_enabled?: boolean | null
          presence_mood_enabled?: boolean | null
          schedule_pattern: Database["public"]["Enums"]["schedule_pattern"]
          sis_block?: number | null
          start_time: string
          type: Database["public"]["Enums"]["section_type"]
          updated_at?: string | null
        }
        Update: {
          attendance_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          days_of_week?: Json | null
          end_time?: string
          expected_location?: Json | null
          geofence_radius?: number | null
          id?: string
          internship_opportunity_id?: string | null
          name?: string
          parent_section_id?: string | null
          presence_enabled?: boolean | null
          presence_mood_enabled?: boolean | null
          schedule_pattern?: Database["public"]["Enums"]["schedule_pattern"]
          sis_block?: number | null
          start_time?: string
          type?: Database["public"]["Enums"]["section_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_internship_opportunity_id_fkey"
            columns: ["internship_opportunity_id"]
            isOneToOne: false
            referencedRelation: "internship_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_parent_section_id_fkey"
            columns: ["parent_section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_parent_section_id_fkey"
            columns: ["parent_section_id"]
            isOneToOne: false
            referencedRelation: "sections_with_enrollment_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          last_sign_in_at: string | null
          phone: string | null
          primary_role: Database["public"]["Enums"]["role_name"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          last_sign_in_at?: string | null
          phone?: string | null
          primary_role: Database["public"]["Enums"]["role_name"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_sign_in_at?: string | null
          phone?: string | null
          primary_role?: Database["public"]["Enums"]["role_name"]
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      sections_with_enrollment_counts: {
        Row: {
          active_student_count: number | null
          created_at: string | null
          created_by: string | null
          days_of_week: Json | null
          end_time: string | null
          expected_location: Json | null
          geofence_radius: number | null
          id: string | null
          internship_opportunity_id: string | null
          name: string | null
          schedule_pattern:
            | Database["public"]["Enums"]["schedule_pattern"]
            | null
          sis_block: number | null
          start_time: string | null
          type: Database["public"]["Enums"]["section_type"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_internship_opportunity_id_fkey"
            columns: ["internship_opportunity_id"]
            isOneToOne: false
            referencedRelation: "internship_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_section_enrollment_count: {
        Args: { section_id_param: string }
        Returns: number
      }
      user_has_role: {
        Args: { check_role: Database["public"]["Enums"]["role_name"] }
        Returns: boolean
      }
    }
    Enums: {
      ab_designation: "a_day" | "b_day"
      event_type: "check_in" | "check_out"
      interaction_type: "prompt_response" | "comment" | "message" | "presence"
      prompt_trigger: "check_in" | "check_out" | "custom"
      role_name: "student" | "teacher" | "admin" | "mentor"
      schedule_pattern: "every_day" | "specific_days" | "a_days" | "b_days"
      section_type: "in_person" | "remote" | "internship"
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
      ab_designation: ["a_day", "b_day"],
      event_type: ["check_in", "check_out"],
      interaction_type: ["prompt_response", "comment", "message", "presence"],
      prompt_trigger: ["check_in", "check_out", "custom"],
      role_name: ["student", "teacher", "admin", "mentor"],
      schedule_pattern: ["every_day", "specific_days", "a_days", "b_days"],
      section_type: ["in_person", "remote", "internship"],
    },
  },
} as const
