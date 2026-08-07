-- Helpdesk: keep the guide links attached to each answer.
--
-- The widget renders an answer's source guides as clickable buttons under it,
-- but hd_messages only stored `content`. The links lived in React state and died
-- with the tab, which did not matter while the chat could not be restored at
-- all. Now that a visitor's thread is reloaded on their next visit, restoring
-- text without links would leave one conversation showing both kinds of answer —
-- older ones bare, newer ones linked — which reads as a bug.
--
-- Shape matches the wire type the widget already uses (ChatSource):
--   [{ "id": "<hd_articles.id>", "title": "…" }, …]
--
-- Note `id` is an hd_articles UUID, not a Notion id. A Notion-side rename does
-- NOT break the link (the sync updates the row, the id is stable); only deleting
-- the article does, and the reader now says so in plain language.
--
-- Additive + idempotent. Existing rows keep NULL, which the widget renders the
-- same as today: answer text, no source buttons.

alter table public.hd_messages add column if not exists sources jsonb;
