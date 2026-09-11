REVOKE ALL ON FUNCTION public.current_tier(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_signal(timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_signal(timestamptz, boolean) TO authenticated;
