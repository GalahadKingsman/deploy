-- Ориентировочное время прохождения курса (часы), для карточки превью.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS estimated_completion_hours integer NULL;
