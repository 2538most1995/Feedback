<?php
require_once 'config.php';

requireAuth();

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS certificate_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        title VARCHAR(255) DEFAULT 'เกียรติบัตร',
        subtitle VARCHAR(255) DEFAULT 'มอบให้ไว้เพื่อแสดงว่า',
        recipient_name VARCHAR(255) DEFAULT '{name}',
        body_text TEXT,
        issued_date VARCHAR(100) DEFAULT '{date}',
        issuer_name VARCHAR(255) DEFAULT '',
        issuer_title VARCHAR(255) DEFAULT '',
        logo_url LONGTEXT,
        signature_url LONGTEXT,
        bg_image_url LONGTEXT,
        bg_preset VARCHAR(50) DEFAULT 'gold-luxury',
        elements_config LONGTEXT,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_certificate_template_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Exception $e) {
    jsonResponse(null, 500, 'ไม่สามารถเตรียมตารางเทมเพลตเกียรติบัตรได้: ' . $e->getMessage());
}

function normalizeTemplateInput($input) {
    $name = trim($input['name'] ?? '');
    if ($name === '') {
        jsonResponse(null, 400, 'กรุณาระบุชื่อเทมเพลต');
    }

    $nameLength = function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name);
    if ($nameLength > 150) {
        jsonResponse(null, 400, 'ชื่อเทมเพลตต้องไม่เกิน 150 ตัวอักษร');
    }

    $elementsConfig = $input['elements_config'] ?? null;
    if (is_array($elementsConfig)) {
        $elementsConfig = json_encode($elementsConfig, JSON_UNESCAPED_UNICODE);
    }

    return [
        'name' => $name,
        'title' => trim($input['title'] ?? 'เกียรติบัตร'),
        'subtitle' => trim($input['subtitle'] ?? 'มอบให้ไว้เพื่อแสดงว่า'),
        'recipient_name' => trim($input['recipient_name'] ?? '{name}'),
        'body_text' => trim($input['body_text'] ?? ''),
        'issued_date' => trim($input['issued_date'] ?? '{date}'),
        'issuer_name' => trim($input['issuer_name'] ?? ''),
        'issuer_title' => trim($input['issuer_title'] ?? ''),
        'logo_url' => $input['logo_url'] ?? '',
        'signature_url' => $input['signature_url'] ?? '',
        'bg_image_url' => $input['bg_image_url'] ?? '',
        'bg_preset' => trim($input['bg_preset'] ?? 'gold-luxury'),
        'elements_config' => $elementsConfig
    ];
}

function isDuplicateTemplateNameError($e) {
    return $e instanceof PDOException && (string)$e->getCode() === '23000';
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    if ($id > 0) {
        $stmt = $pdo->prepare('SELECT * FROM certificate_templates WHERE id = ?');
        $stmt->execute([$id]);
        $template = $stmt->fetch();

        if (!$template) {
            jsonResponse(null, 404, 'ไม่พบเทมเพลตเกียรติบัตรที่ระบุ');
        }

        if ($template['elements_config'] && is_string($template['elements_config'])) {
            $decoded = json_decode($template['elements_config'], true);
            $template['elements_config'] = is_array($decoded) ? $decoded : null;
        }

        jsonResponse($template);
    }

    $stmt = $pdo->query('SELECT id, name, bg_preset, created_at, updated_at FROM certificate_templates ORDER BY updated_at DESC, id DESC');
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $data = normalizeTemplateInput(getJsonInput() ?: []);

    try {
        $stmt = $pdo->prepare("INSERT INTO certificate_templates
            (name, title, subtitle, recipient_name, body_text, issued_date, issuer_name, issuer_title,
             logo_url, signature_url, bg_image_url, bg_preset, elements_config, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $data['name'], $data['title'], $data['subtitle'], $data['recipient_name'],
            $data['body_text'], $data['issued_date'], $data['issuer_name'], $data['issuer_title'],
            $data['logo_url'], $data['signature_url'], $data['bg_image_url'], $data['bg_preset'],
            $data['elements_config'], $_SESSION['admin_id'] ?? null
        ]);

        $id = (int)$pdo->lastInsertId();
        jsonResponse(['id' => $id, 'name' => $data['name']], 201, 'บันทึกเทมเพลตเกียรติบัตรสำเร็จ');
    } catch (Exception $e) {
        if (isDuplicateTemplateNameError($e)) {
            jsonResponse(null, 409, 'ชื่อเทมเพลตนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่นหรือกดอัปเดตเทมเพลตเดิม');
        }
        jsonResponse(null, 500, 'เกิดข้อผิดพลาดในการบันทึกเทมเพลต: ' . $e->getMessage());
    }
}

if ($method === 'PUT') {
    $input = getJsonInput() ?: [];
    $id = isset($input['id']) ? (int)$input['id'] : 0;
    if ($id <= 0) {
        jsonResponse(null, 400, 'กรุณาระบุเทมเพลตที่ต้องการอัปเดต');
    }

    $data = normalizeTemplateInput($input);

    try {
        $stmt = $pdo->prepare("UPDATE certificate_templates SET
            name = ?, title = ?, subtitle = ?, recipient_name = ?, body_text = ?, issued_date = ?,
            issuer_name = ?, issuer_title = ?, logo_url = ?, signature_url = ?, bg_image_url = ?,
            bg_preset = ?, elements_config = ?, updated_at = NOW()
            WHERE id = ?");
        $stmt->execute([
            $data['name'], $data['title'], $data['subtitle'], $data['recipient_name'],
            $data['body_text'], $data['issued_date'], $data['issuer_name'], $data['issuer_title'],
            $data['logo_url'], $data['signature_url'], $data['bg_image_url'], $data['bg_preset'],
            $data['elements_config'], $id
        ]);

        if ($stmt->rowCount() === 0) {
            $check = $pdo->prepare('SELECT id FROM certificate_templates WHERE id = ?');
            $check->execute([$id]);
            if (!$check->fetch()) {
                jsonResponse(null, 404, 'ไม่พบเทมเพลตเกียรติบัตรที่ต้องการอัปเดต');
            }
        }

        jsonResponse(['id' => $id, 'name' => $data['name']], 200, 'อัปเดตเทมเพลตเกียรติบัตรสำเร็จ');
    } catch (Exception $e) {
        if (isDuplicateTemplateNameError($e)) {
            jsonResponse(null, 409, 'ชื่อเทมเพลตนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น');
        }
        jsonResponse(null, 500, 'เกิดข้อผิดพลาดในการอัปเดตเทมเพลต: ' . $e->getMessage());
    }
}

if ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) {
        jsonResponse(null, 400, 'กรุณาระบุเทมเพลตที่ต้องการลบ');
    }

    $stmt = $pdo->prepare('DELETE FROM certificate_templates WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        jsonResponse(null, 404, 'ไม่พบเทมเพลตเกียรติบัตรที่ต้องการลบ');
    }

    jsonResponse(null, 200, 'ลบเทมเพลตเกียรติบัตรสำเร็จ');
}

jsonResponse(null, 405, 'Method not allowed');
