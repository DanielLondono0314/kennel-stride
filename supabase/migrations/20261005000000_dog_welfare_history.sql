-- ============================================================================
-- Historial de rondas de bienestar de un perro, para cualquier miembro del
-- centro (app del trabajador → ficha del perro → "Bienestar").
--
-- welfare_check_entries se ve a través de tasks, y un trabajador solo ve las
-- tareas asignadas a él: sin esto vería solo SUS rondas y el historial del
-- perro quedaría incompleto. Esta función es de solo lectura, exige que el
-- perro sea de una org del usuario y devuelve solo rondas ya realizadas.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dog_welfare_history(p_dog_id uuid, p_limit int DEFAULT 30)
RETURNS TABLE (
  entry_id     uuid,
  checked_at   timestamptz,
  round_title  text,
  present      boolean,
  flags        jsonb,
  notes        text,
  checked_by   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id,
         COALESCE(t.completed_at, t.due_at, e.created_at),
         t.title,
         e.present,
         COALESCE(e.flags, '{}'::jsonb),
         e.notes,
         NULLIF(trim(COALESCE(sm.first_name, '') || ' ' || COALESCE(sm.last_name, '')), '')
  FROM public.welfare_check_entries e
  JOIN public.tasks t ON t.id = e.task_id
  JOIN public.dogs d ON d.id = e.dog_id
  LEFT JOIN public.staff_members sm ON sm.id = COALESCE(t.completed_by, t.assignee_staff_id)
  WHERE e.dog_id = p_dog_id
    AND d.organization_id IN (SELECT public.get_user_org_ids())
    AND t.status = 'done'
  ORDER BY COALESCE(t.completed_at, t.due_at, e.created_at) DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

REVOKE EXECUTE ON FUNCTION public.get_dog_welfare_history(uuid, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_dog_welfare_history(uuid, int) TO authenticated;
