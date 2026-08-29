USE feedback_system;

ALTER TABLE survey_questions
  ADD COLUMN question_description TEXT NULL AFTER question_text,
  MODIFY COLUMN question_type ENUM('radio','rating','text','checkbox','dropdown') DEFAULT 'rating';
