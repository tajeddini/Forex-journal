-- Keep image metadata bound to a trade owned by the authenticated user
-- on both the old row and the new row during updates.
DROP POLICY IF EXISTS trade_images_update_own ON public.trade_images;

CREATE POLICY trade_images_update_own
ON public.trade_images
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.trades t
    WHERE t.id = trade_images.trade_id
      AND t.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.trades t
    WHERE t.id = trade_images.trade_id
      AND t.user_id = (SELECT auth.uid())
  )
);
