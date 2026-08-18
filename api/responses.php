<?php
// /Applications/MAMP/htdocs/Feedback/api/responses.php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    // Public endpoint to submit a response
    $input = getJsonInput();
    $survey_id = isset($input['survey_id']) ? (int)$input['survey_id'] : null;
    $answers = $input['answers'] ?? [];
    
    if (!$survey_id) {
        jsonResponse(null, 400, "ไม่พบรหัสแบบประเมิน (Missing survey_id)");
    }
    
    // Check if survey exists and is published (or allow if admin session / preview)
    $stmtCheck = $pdo->prepare("SELECT * FROM surveys WHERE id = ?");
    $stmtCheck->execute([$survey_id]);
    $survey = $stmtCheck->fetch();
    
    if (!$survey) {
        jsonResponse(null, 404, "ไม่พบแบบประเมินที่ระบุ");
    }
    
    $isAdmin = isset($_SESSION['admin_id']);
    if (!$isAdmin && $survey['status'] !== 'published') {
        jsonResponse(null, 403, "แบบประเมินนี้ปิดรับความคิดเห็นแล้ว");
    }
    
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("INSERT INTO responses (survey_id, respondent_name, gender, age_range, role, ip_address, submitted_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([
            $survey_id,
            trim($input['respondent_name'] ?? ''),
            trim($input['gender'] ?? ''),
            trim($input['age_range'] ?? ''),
            trim($input['role'] ?? ''),
            $_SERVER['REMOTE_ADDR'] ?? ''
        ]);
        $responseId = $pdo->lastInsertId();
        
        if (!empty($answers) && is_array($answers)) {
            $stmtA = $pdo->prepare("INSERT INTO response_answers (response_id, question_id, rating_value, text_value) VALUES (?, ?, ?, ?)");
            foreach ($answers as $ans) {
                if (empty($ans['question_id'])) continue;
                
                $ratingVal = isset($ans['rating_value']) && $ans['rating_value'] !== null ? (int)$ans['rating_value'] : null;
                $textVal = isset($ans['text_value']) && $ans['text_value'] !== null ? trim($ans['text_value']) : null;
                
                $stmtA->execute([
                    $responseId,
                    (int)$ans['question_id'],
                    $ratingVal,
                    $textVal
                ]);
            }
        }
        
        $pdo->commit();
        jsonResponse(['id' => (int)$responseId], 201, "ส่งแบบประเมินเรียบร้อยแล้ว ขอบคุณสำหรับข้อมูล");
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(null, 500, "เกิดข้อผิดพลาดในการบันทึกข้อมูล: " . $e->getMessage());
    }
} elseif ($method === 'GET') {
    requireAuth();
    
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        $stmt = $pdo->prepare("SELECT r.*, s.title as survey_title FROM responses r JOIN surveys s ON r.survey_id = s.id WHERE r.id = ?");
        $stmt->execute([$id]);
        $response = $stmt->fetch();
        
        if (!$response) {
            jsonResponse(null, 404, "ไม่พบข้อมูลคำตอบ");
        }
        
        $stmtA = $pdo->prepare("SELECT ra.*, sq.question_text, sq.question_type, ss.title as section_title 
            FROM response_answers ra 
            LEFT JOIN survey_questions sq ON ra.question_id = sq.id 
            LEFT JOIN survey_sections ss ON sq.section_id = ss.id 
            WHERE ra.response_id = ?
            ORDER BY ss.sort_order ASC, sq.sort_order ASC, ra.id ASC");
        $stmtA->execute([$id]);
        $response['answers'] = $stmtA->fetchAll();
        
        jsonResponse($response);
    } elseif (isset($_GET['survey_id'])) {
        $survey_id = (int)$_GET['survey_id'];
        $stmt = $pdo->prepare("SELECT r.*, s.title as survey_title,
            (SELECT AVG(rating_value) FROM response_answers WHERE response_id = r.id AND rating_value IS NOT NULL) as avg_rating
            FROM responses r 
            JOIN surveys s ON r.survey_id = s.id 
            WHERE r.survey_id = ? 
            ORDER BY r.submitted_at DESC");
        $stmt->execute([$survey_id]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['avg_rating'] = $row['avg_rating'] !== null ? round((float)$row['avg_rating'], 2) : null;
        }
        jsonResponse($rows);
    } else {
        // All recent responses
        $stmt = $pdo->query("SELECT r.*, s.title as survey_title,
            (SELECT AVG(rating_value) FROM response_answers WHERE response_id = r.id AND rating_value IS NOT NULL) as avg_rating
            FROM responses r 
            JOIN surveys s ON r.survey_id = s.id 
            ORDER BY r.submitted_at DESC LIMIT 300");
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['avg_rating'] = $row['avg_rating'] !== null ? round((float)$row['avg_rating'], 2) : null;
        }
        jsonResponse($rows);
    }
} elseif ($method === 'DELETE') {
    requireAuth();
    $id = isset($_GET['id']) ? (int)$_GET['id'] : (isset(getJsonInput()['id']) ? (int)getJsonInput()['id'] : null);
    
    if (!$id) {
        jsonResponse(null, 400, "กรุณาระบุรหัสคำตอบที่ต้องการลบ");
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM responses WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['id' => $id], 200, "ลบข้อมูลคำตอบเรียบร้อยแล้ว");
    } catch (Exception $e) {
        jsonResponse(null, 500, "เกิดข้อผิดพลาดในการลบคำตอบ: " . $e->getMessage());
    }
} else {
    jsonResponse(null, 405, "Method not allowed");
}
