<?php
// /Applications/MAMP/htdocs/Feedback/api/certificates.php
require_once 'config.php';

// Ensure table exists with maximum MySQL/MariaDB compatibility
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS certificates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        survey_id INT NOT NULL,
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
        elements_config LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cert_survey (survey_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Exception $e) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS certificates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            survey_id INT NOT NULL,
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
            elements_config LONGTEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_cert_survey (survey_id)
        )");
    } catch (Exception $e2) {
        // Table exists or fallback
    }
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Can be called publicly (for respondent certificate generation) or by admin
    $survey_id = isset($_GET['survey_id']) ? (int)$_GET['survey_id'] : null;

    if ($survey_id) {
        $stmt = $pdo->prepare("SELECT c.*, s.title as survey_title FROM certificates c JOIN surveys s ON c.survey_id = s.id WHERE c.survey_id = ?");
        $stmt->execute([$survey_id]);
        $cert = $stmt->fetch();

        if (!$cert) {
            // Return default template for this survey if not yet saved
            $stmtS = $pdo->prepare("SELECT id, title, category FROM surveys WHERE id = ?");
            $stmtS->execute([$survey_id]);
            $survey = $stmtS->fetch();

            if (!$survey) {
                jsonResponse(null, 404, "ไม่พบแบบประเมินที่ระบุ");
            }

            $defaultCert = [
                'id' => null,
                'survey_id' => $survey['id'],
                'survey_title' => $survey['title'],
                'is_enabled' => 0,
                'title' => 'เกียรติบัตร',
                'subtitle' => 'มอบให้ไว้เพื่อแสดงว่า',
                'recipient_name' => '{name}',
                'body_text' => 'ได้ผ่านการตอบแบบประเมินความพึงพอใจและมีส่วนร่วมในกิจกรรม ' . $survey['title'] . ' ให้ไว้ ณ วันที่ {date} ขอให้มีความสุขความเจริญก้าวหน้ายิ่งขึ้นไป',
                'issued_date' => '{date}',
                'issuer_name' => 'ผู้ช่วยศาสตราจารย์ ดร.สมชาย ใจดี',
                'issuer_title' => 'ผู้อำนวยการศูนย์บริการและพัฒนา',
                'logo_url' => '',
                'signature_url' => '',
                'bg_image_url' => '',
                'bg_preset' => 'gold-luxury',
                'elements_config' => null
            ];
            jsonResponse($defaultCert, 200, "เทมเพลตเริ่มต้น");
        }

        if ($cert['elements_config'] && is_string($cert['elements_config'])) {
            $cert['elements_config'] = json_decode($cert['elements_config'], true);
        }

        jsonResponse($cert);
    } else {
        // List all surveys and their certificate status (admin only)
        requireAuth();
        
        $sql = "SELECT s.id as survey_id, s.title as survey_title, s.category, s.status,
                       c.id as cert_id, c.is_enabled, c.updated_at as cert_updated_at, c.bg_preset
                FROM surveys s
                LEFT JOIN certificates c ON s.id = c.survey_id
                ORDER BY s.id DESC";
        $stmt = $pdo->query($sql);
        $list = $stmt->fetchAll();
        jsonResponse($list);
    }
} elseif ($method === 'POST' || $method === 'PUT') {
    requireAuth();
    $input = getJsonInput();

    $survey_id = isset($input['survey_id']) ? (int)$input['survey_id'] : null;
    if (!$survey_id) {
        jsonResponse(null, 400, "กรุณาระบุ survey_id");
    }

    $is_enabled = isset($input['is_enabled']) ? ($input['is_enabled'] ? 1 : 0) : 1;
    $title = trim($input['title'] ?? 'เกียรติบัตร');
    $subtitle = trim($input['subtitle'] ?? 'มอบให้ไว้เพื่อแสดงว่า');
    $recipient_name = trim($input['recipient_name'] ?? '{name}');
    $body_text = trim($input['body_text'] ?? '');
    $issued_date = trim($input['issued_date'] ?? '{date}');
    $issuer_name = trim($input['issuer_name'] ?? '');
    $issuer_title = trim($input['issuer_title'] ?? '');
    $logo_url = $input['logo_url'] ?? '';
    $signature_url = $input['signature_url'] ?? '';
    $bg_image_url = $input['bg_image_url'] ?? '';
    $bg_preset = trim($input['bg_preset'] ?? 'gold-luxury');
    $elements_config = isset($input['elements_config']) ? (is_array($input['elements_config']) ? json_encode($input['elements_config'], JSON_UNESCAPED_UNICODE) : $input['elements_config']) : null;

    try {
        $stmtCheck = $pdo->prepare("SELECT id FROM certificates WHERE survey_id = ?");
        $stmtCheck->execute([$survey_id]);
        $exists = $stmtCheck->fetch();

        if ($exists) {
            $stmt = $pdo->prepare("UPDATE certificates SET 
                is_enabled = ?, title = ?, subtitle = ?, recipient_name = ?, body_text = ?, 
                issued_date = ?, issuer_name = ?, issuer_title = ?, logo_url = ?, signature_url = ?, 
                bg_image_url = ?, bg_preset = ?, elements_config = ?, updated_at = NOW() 
                WHERE survey_id = ?");
            $stmt->execute([
                $is_enabled, $title, $subtitle, $recipient_name, $body_text,
                $issued_date, $issuer_name, $issuer_title, $logo_url, $signature_url,
                $bg_image_url, $bg_preset, $elements_config, $survey_id
            ]);
            jsonResponse(['id' => $exists['id'], 'survey_id' => $survey_id], 200, "บันทึกการตั้งค่าเกียรติบัตรสำเร็จ");
        } else {
            $stmt = $pdo->prepare("INSERT INTO certificates 
                (survey_id, is_enabled, title, subtitle, recipient_name, body_text, issued_date, issuer_name, issuer_title, logo_url, signature_url, bg_image_url, bg_preset, elements_config) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $survey_id, $is_enabled, $title, $subtitle, $recipient_name, $body_text,
                $issued_date, $issuer_name, $issuer_title, $logo_url, $signature_url,
                $bg_image_url, $bg_preset, $elements_config
            ]);
            $newId = $pdo->lastInsertId();
            jsonResponse(['id' => $newId, 'survey_id' => $survey_id], 201, "สร้างการตั้งค่าเกียรติบัตรสำเร็จ");
        }
    } catch (Exception $e) {
        jsonResponse(null, 500, "เกิดข้อผิดพลาดในการบันทึก: " . $e->getMessage());
    }
} elseif ($method === 'DELETE') {
    requireAuth();
    $survey_id = isset($_GET['survey_id']) ? (int)$_GET['survey_id'] : null;
    if (!$survey_id) {
        jsonResponse(null, 400, "กรุณาระบุ survey_id");
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM certificates WHERE survey_id = ?");
        $stmt->execute([$survey_id]);
        jsonResponse(null, 200, "ลบการตั้งค่าเกียรติบัตรสำเร็จ");
    } catch (Exception $e) {
        jsonResponse(null, 500, "เกิดข้อผิดพลาดในการลบ: " . $e->getMessage());
    }
}
