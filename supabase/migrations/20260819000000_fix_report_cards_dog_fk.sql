-- report_cards.dog_id se creó como `text` sin foreign key hacia dogs.id (uuid).
-- Sin esa relación, PostgREST no puede resolver el embed `dogs(...)` que usa
-- ReportCardsPage/useReportCards, y la página falla con "Error al cargar datos".
ALTER TABLE public.report_cards
  ALTER COLUMN dog_id TYPE uuid USING dog_id::uuid;

ALTER TABLE public.report_cards
  ADD CONSTRAINT report_cards_dog_id_fkey
  FOREIGN KEY (dog_id) REFERENCES public.dogs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_report_cards_dog_id ON public.report_cards(dog_id);
