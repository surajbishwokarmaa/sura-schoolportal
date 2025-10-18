-- Create system_guides table for storing help documentation
CREATE TABLE IF NOT EXISTS public.system_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_guides ENABLE ROW LEVEL SECURITY;

-- Admin can manage system guides
CREATE POLICY "Admin can manage system guides"
ON public.system_guides
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Everyone can view system guides
CREATE POLICY "Everyone can view system guides"
ON public.system_guides
FOR SELECT
USING (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_system_guides_updated_at
BEFORE UPDATE ON public.system_guides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();