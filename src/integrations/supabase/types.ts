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
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
          sections: string[] | null
          subjects: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sections?: string[] | null
          subjects: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sections?: string[] | null
          subjects?: Json
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string
          id: string
          parent_phone: string
          student_ids: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          parent_phone: string
          student_ids: string[]
        }
        Update: {
          created_at?: string
          id?: string
          parent_phone?: string
          student_ids?: string[]
        }
        Relationships: []
      }
      notices: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          expiry_date: string | null
          id: string
          is_auto_generated: boolean | null
          title: string
          visible_to: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          expiry_date?: string | null
          id?: string
          is_auto_generated?: boolean | null
          title: string
          visible_to?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          expiry_date?: string | null
          id?: string
          is_auto_generated?: boolean | null
          title?: string
          visible_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          photo_url?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          class: string
          created_at: string
          gpa: number | null
          grade: string | null
          id: string
          practical_marks: number | null
          remarks: string | null
          status: Database["public"]["Enums"]["result_status"] | null
          student_id: string
          subject: string
          subject_id: string | null
          teacher_id: string | null
          term: Database["public"]["Enums"]["term_type"]
          theory_marks: number | null
          total_marks: number | null
          updated_at: string
        }
        Insert: {
          class: string
          created_at?: string
          gpa?: number | null
          grade?: string | null
          id?: string
          practical_marks?: number | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["result_status"] | null
          student_id: string
          subject: string
          subject_id?: string | null
          teacher_id?: string | null
          term: Database["public"]["Enums"]["term_type"]
          theory_marks?: number | null
          total_marks?: number | null
          updated_at?: string
        }
        Update: {
          class?: string
          created_at?: string
          gpa?: number | null
          grade?: string | null
          id?: string
          practical_marks?: number | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["result_status"] | null
          student_id?: string
          subject?: string
          subject_id?: string | null
          teacher_id?: string | null
          term?: Database["public"]["Enums"]["term_type"]
          theory_marks?: number | null
          total_marks?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          class: string
          created_at: string
          dob: string | null
          gender: Database["public"]["Enums"]["student_gender"] | null
          id: string
          is_active: boolean | null
          name: string
          parent_name: string | null
          parent_phone: string
          photo_url: string | null
          roll_no: string
          section: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          class: string
          created_at?: string
          dob?: string | null
          gender?: Database["public"]["Enums"]["student_gender"] | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_name?: string | null
          parent_phone: string
          photo_url?: string | null
          roll_no: string
          section: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          class?: string
          created_at?: string
          dob?: string | null
          gender?: Database["public"]["Enums"]["student_gender"] | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_name?: string | null
          parent_phone?: string
          photo_url?: string | null
          roll_no?: string
          section?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_id: string | null
          created_at: string | null
          id: string
          is_equal_split: boolean | null
          name: string
          practical_full_marks: number
          theory_full_marks: number
          total_marks: number
          updated_at: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          is_equal_split?: boolean | null
          name: string
          practical_full_marks?: number
          theory_full_marks?: number
          total_marks?: number
          updated_at?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          id?: string
          is_equal_split?: boolean | null
          name?: string
          practical_full_marks?: number
          theory_full_marks?: number
          total_marks?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      system_guides: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          classes_assigned: string[]
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          subjects: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          classes_assigned: string[]
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          subjects: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          classes_assigned?: string[]
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          subjects?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_grade_gpa: {
        Args: { marks: number }
        Returns: {
          gpa: number
          grade: string
        }[]
      }
      get_student_login_info: {
        Args: { parent_phone_input: string }
        Returns: {
          roll_no: string
          student_email: string
          student_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      result_status: "pending" | "approved" | "published"
      student_gender: "male" | "female" | "other"
      term_type: "first_term" | "second_term" | "third_term" | "final_term"
      user_role: "admin" | "teacher" | "student"
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
      result_status: ["pending", "approved", "published"],
      student_gender: ["male", "female", "other"],
      term_type: ["first_term", "second_term", "third_term", "final_term"],
      user_role: ["admin", "teacher", "student"],
    },
  },
} as const
