-- /Applications/MAMP/htdocs/Feedback/database.sql
DROP DATABASE IF EXISTS feedback_system;
CREATE DATABASE feedback_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE feedback_system;

CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  fullname VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admins (username, password_hash, fullname) 
VALUES ('admin', '$2y$12$8MZmFS2mUYjbVOpnPDM/q.HlX0MDJ4vRo66ImVmi8TvxM9uZ9MDGy', 'ผู้ดูแลระบบ');
-- password is admin123

CREATE TABLE surveys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT '',
  description TEXT,
  status ENUM('draft','published','closed') DEFAULT 'draft',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

CREATE TABLE survey_sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  survey_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  section_type ENUM('demographic','rating','text') DEFAULT 'rating',
  sort_order INT DEFAULT 0,
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

CREATE TABLE survey_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  question_text VARCHAR(500) NOT NULL,
  question_type ENUM('radio','rating','text','checkbox') DEFAULT 'rating',
  options_json JSON,
  is_required TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (section_id) REFERENCES survey_sections(id) ON DELETE CASCADE
);

CREATE TABLE responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  survey_id INT NOT NULL,
  respondent_name VARCHAR(100) DEFAULT '',
  gender VARCHAR(20) DEFAULT '',
  age_range VARCHAR(30) DEFAULT '',
  role VARCHAR(50) DEFAULT '',
  ip_address VARCHAR(45) DEFAULT '',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

CREATE TABLE response_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  response_id INT NOT NULL,
  question_id INT NOT NULL,
  rating_value INT DEFAULT NULL,
  text_value TEXT DEFAULT NULL,
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE
);

CREATE TABLE certificates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  survey_id INT NOT NULL UNIQUE,
  is_enabled TINYINT(1) DEFAULT 1,
  title VARCHAR(255) DEFAULT 'เกียรติบัตร',
  subtitle VARCHAR(255) DEFAULT 'มอบให้ไว้เพื่อแสดงว่า',
  recipient_name VARCHAR(255) DEFAULT '{name}',
  body_text TEXT,
  issued_date VARCHAR(100) DEFAULT '{date}',
  issuer_name VARCHAR(255) DEFAULT 'ผู้อำนวยการ / ผู้จัดงาน',
  issuer_title VARCHAR(255) DEFAULT 'ตำแหน่งผู้มีอำนาจลงนาม',
  logo_url LONGTEXT,
  signature_url LONGTEXT,
  bg_image_url LONGTEXT,
  bg_preset VARCHAR(50) DEFAULT 'gold-luxury',
  elements_config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

-- SAMPLE DATA
INSERT INTO surveys (id, title, category, description, status, created_by) VALUES 
(1, 'แบบประเมินความพึงพอใจการจัดกิจกรรมสัมมนาวิชาการ', 'สัมมนา', 'ขอความอนุเคราะห์ตอบแบบสอบถามเพื่อนำไปปรับปรุงการจัดกิจกรรมในครั้งต่อไป', 'published', 1),
(2, 'แบบประเมินการให้บริการของศูนย์บรรณสาร', 'บริการ', 'แบบประเมินความพึงพอใจการให้บริการห้องสมุด ประจำปี 2566', 'draft', 1);

-- Survey 1: Sections
INSERT INTO survey_sections (id, survey_id, title, section_type, sort_order) VALUES 
(1, 1, 'ส่วนที่ 1: ข้อมูลผู้ตอบแบบประเมิน', 'demographic', 1),
(2, 1, 'ส่วนที่ 2: ความพึงพอใจต่อการจัดกิจกรรม', 'rating', 2),
(3, 1, 'ส่วนที่ 3: ข้อคิดเห็นและข้อเสนอแนะ', 'text', 3);

-- Survey 1: Questions
-- Section 1
INSERT INTO survey_questions (id, section_id, question_text, question_type, options_json, is_required, sort_order) VALUES 
(1, 1, 'เพศ', 'radio', '["ชาย", "หญิง", "อื่นๆ"]', 1, 1),
(2, 1, 'อายุ', 'radio', '["ต่ำกว่า 20 ปี", "20-30 ปี", "31-40 ปี", "41-50 ปี", "50 ปีขึ้นไป"]', 1, 2),
(3, 1, 'บทบาท/สถานะ', 'radio', '["นักศึกษา", "อาจารย์", "บุคลากร", "บุคคลภายนอก"]', 1, 3);
-- Section 2
INSERT INTO survey_questions (id, section_id, question_text, question_type, options_json, is_required, sort_order) VALUES 
(4, 2, 'การประชาสัมพันธ์กิจกรรม', 'rating', null, 1, 1),
(5, 2, 'ความเหมาะสมของวันและเวลาในการจัดกิจกรรม', 'rating', null, 1, 2),
(6, 2, 'ความเหมาะสมของเนื้อหาที่จัด', 'rating', null, 1, 3),
(7, 2, 'ความรู้ความสามารถของวิทยากร', 'rating', null, 1, 4),
(8, 2, 'สื่อและอุปกรณ์ที่ใช้ประกอบการบรรยาย', 'rating', null, 1, 5),
(9, 2, 'การอำนวยความสะดวกของเจ้าหน้าที่', 'rating', null, 1, 6),
(10, 2, 'ความเหมาะสมของสถานที่จัดกิจกรรม', 'rating', null, 1, 7),
(11, 2, 'ภาพรวมความพึงพอใจต่อกิจกรรมในครั้งนี้', 'rating', null, 1, 8);
-- Section 3
INSERT INTO survey_questions (id, section_id, question_text, question_type, options_json, is_required, sort_order) VALUES 
(12, 3, 'ข้อเสนอแนะเพิ่มเติม', 'text', null, 0, 1);

-- Generate sample responses
DELIMITER //
CREATE PROCEDURE GenerateSampleResponses()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE res_id INT;
  DECLARE rand_val INT;
  DECLARE role_str VARCHAR(50);
  DECLARE gender_str VARCHAR(50);
  DECLARE age_str VARCHAR(50);

  WHILE i <= 50 DO
    -- Assign random demographics
    SET rand_val = FLOOR(1 + (RAND() * 4));
    IF rand_val = 1 THEN SET role_str = 'นักศึกษา';
    ELSEIF rand_val = 2 THEN SET role_str = 'อาจารย์';
    ELSEIF rand_val = 3 THEN SET role_str = 'บุคลากร';
    ELSE SET role_str = 'บุคคลภายนอก'; END IF;

    SET rand_val = FLOOR(1 + (RAND() * 2));
    IF rand_val = 1 THEN SET gender_str = 'ชาย';
    ELSE SET gender_str = 'หญิง'; END IF;

    SET rand_val = FLOOR(1 + (RAND() * 4));
    IF rand_val = 1 THEN SET age_str = '20-30 ปี';
    ELSEIF rand_val = 2 THEN SET age_str = '31-40 ปี';
    ELSEIF rand_val = 3 THEN SET age_str = '41-50 ปี';
    ELSE SET age_str = '50 ปีขึ้นไป'; END IF;

    INSERT INTO responses (survey_id, gender, age_range, role, ip_address, submitted_at)
    VALUES (1, gender_str, age_str, role_str, '127.0.0.1', DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY));
    SET res_id = LAST_INSERT_ID();

    -- Demographic answers (Q 1,2,3) (Normally wouldn't save in answers table if saved in responses directly, but we can sync them)
    -- Actually they might be in responses table. Let's just insert ratings.
    
    -- Ratings (Q 4-11) around 4.0 - 4.5 average
    INSERT INTO response_answers (response_id, question_id, rating_value) VALUES 
    (res_id, 4, FLOOR(3 + RAND() * 3)), -- 3 to 5
    (res_id, 5, FLOOR(4 + RAND() * 2)), -- 4 to 5
    (res_id, 6, FLOOR(4 + RAND() * 2)),
    (res_id, 7, FLOOR(4 + RAND() * 2)),
    (res_id, 8, FLOOR(3 + RAND() * 3)),
    (res_id, 9, FLOOR(4 + RAND() * 2)),
    (res_id, 10, FLOOR(3 + RAND() * 3)),
    (res_id, 11, FLOOR(4 + RAND() * 2));
    
    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;

CALL GenerateSampleResponses();
DROP PROCEDURE GenerateSampleResponses;
