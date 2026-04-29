-- Ссылка для зачисления (Telegram, сайт и т.д.): открывается по кнопке «Записаться» в превью курса.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS enrollment_contact_url text NULL;
