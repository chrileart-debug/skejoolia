-- Allow users to delete their own settings (needed for re-registration flow)
CREATE POLICY "Users can delete own settings" 
ON public.user_settings 
FOR DELETE 
USING (auth.uid() = user_id);