<?php
// /Applications/MAMP/htdocs/Feedback/api/surveys.php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $public = isset($_GET['public']) && $_GET['public'] == '1';
    $preview = isset($_GET['preview']) && $_GET['preview'] == '1';
    $isAdmin = isset($_SESSION['admin_id']);

    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        
        // If not public and not admin, require auth
        if (!$public && !$isAdmin) {
            requireAuth();
        }
        
        $stmt = $pdo->prepare("SELECT * FROM surveys WHERE id = ?");
        $stmt->execute([$id]);
        $survey = $stmt->fetch();
        
        if (!$survey) {
            jsonResponse(null, 404, "ไม่พบแบบประเมินที่ระบุ");
        }
        
        // Allow viewing draft/closed if admin is logged in or preview flag with admin
        if ($public && !$isAdmin && !$preview && $survey['status'] !== 'published') {
            jsonResponse(null, 403, "แบบประเมินนี้ยังไม่เปิดให้ตอบ หรือปิดรับความคิดเห็นแล้ว");
        }
        
        $stmt = $pdo->prepare("SELECT * FROM survey_sections WHERE survey_id = ? ORDER BY sort_order ASC, id ASC");
        $stmt->execute([$id]);
        $sections = $stmt->fetchAll();
        
        foreach ($sections as &$section) {
            $stmtQ = $pdo->prepare("SELECT * FROM survey_questions WHERE section_id = ? ORDER BY sort_order ASC, id ASC");
            $stmtQ->execute([$section['id']]);
            $section['questions'] = $stmtQ->fetchAll();
            foreach ($section['questions'] as &$q) {
                if (!empty($q['options_json'])) {
                    $decoded = json_decode($q['options_json'], true);
                    $q['options'] = is_array($decoded) ? $decoded : [];
                } else {
                    $q['options'] = [];
                }
            }
        }
        $survey['sections'] = $sections;
        
        // Include response stats for this survey
        $stmtStats = $pdo->prepare("SELECT COUNT(*) as response_count, 
            (SELECT AVG(ra.rating_value) FROM response_answers ra JOIN responses r ON ra.response_id = r.id WHERE r.survey_id = ?) as avg_rating 
            FROM responses WHERE survey_id = ?");
        $stmtStats->execute([$id, $id]);
        $stats = $stmtStats->fetch();
        $survey['response_count'] = (int)($stats['response_count'] ?? 0);
        $survey['avg_rating'] = $stats['avg_rating'] !== null ? round((float)$stats['avg_rating'], 2) : null;

        jsonResponse($survey);
    } elseif ($public) {
        // Public listing: return only published surveys
        $stmt = $pdo->query("SELECT s.id, s.title, s.category, s.description, s.status, s.created_at,
            (SELECT COUNT(*) FROM responses WHERE survey_id = s.id) as response_count
            FROM surveys s WHERE s.status = 'published' ORDER BY s.created_at DESC");
        jsonResponse($stmt->fetchAll());
    } else {
        // Admin listing: return all surveys with stats
        requireAuth();
        $stmt = $pdo->query("SELECT s.*, 
            (SELECT COUNT(*) FROM responses WHERE survey_id = s.id) as response_count,
            (SELECT AVG(ra.rating_value) FROM response_answers ra JOIN responses r ON ra.response_id = r.id WHERE r.survey_id = s.id AND ra.rating_value IS NOT NULL) as avg_rating
            FROM surveys s ORDER BY s.id DESC");
        $surveys = $stmt->fetchAll();
        foreach ($surveys as &$s) {
            $s['response_count'] = (int)($s['response_count'] ?? 0);
            $s['avg_rating'] = $s['avg_rating'] !== null ? round((float)$s['avg_rating'], 2) : null;
        }
        jsonResponse($surveys);
    }
} elseif ($method === 'POST') {
    requireAuth();
    $input = getJsonInput();
    
    $title = trim($input['title'] ?? '');
    if (empty($title)) {
        jsonResponse(null, 400, "กรุณาระบุชื่อแบบประเมิน");
    }
    
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("INSERT INTO surveys (title, category, description, status, created_by) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $title,
            trim($input['category'] ?? 'ทั่วไป'),
            trim($input['description'] ?? ''),
            $input['status'] ?? 'draft',
            $_SESSION['admin_id'] ?? 1
        ]);
        $surveyId = $pdo->lastInsertId();
        
        if (!empty($input['sections']) && is_array($input['sections'])) {
            foreach ($input['sections'] as $sIndex => $section) {
                $secTitle = trim($section['title'] ?? ('ส่วนที่ ' . ($sIndex + 1)));
                $secType = $section['section_type'] ?? 'rating';
                
                $stmtSec = $pdo->prepare("INSERT INTO survey_sections (survey_id, title, section_type, sort_order) VALUES (?, ?, ?, ?)");
                $stmtSec->execute([$surveyId, $secTitle, $secType, $sIndex + 1]);
                $sectionId = $pdo->lastInsertId();
                
                if (!empty($section['questions']) && is_array($section['questions'])) {
                    foreach ($section['questions'] as $qIndex => $question) {
                        $qText = trim($question['question_text'] ?? '');
                        if (empty($qText)) continue;
                        
                        $qDescription = trim($question['question_description'] ?? $question['description'] ?? '');
                        $qType = $question['question_type'] ?? 'rating';
                        $optionsJson = null;
                        if (!empty($question['options']) && is_array($question['options'])) {
                            $cleanOpts = array_values(array_filter(array_map('trim', $question['options'])));
                            if (!empty($cleanOpts)) {
                                $optionsJson = json_encode($cleanOpts, JSON_UNESCAPED_UNICODE);
                            }
                        }
                        
                        $stmtQ = $pdo->prepare("INSERT INTO survey_questions (section_id, question_text, question_description, question_type, options_json, is_required, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
                        $stmtQ->execute([
                            $sectionId, 
                            $qText, 
                            $qDescription,
                            $qType,
                            $optionsJson,
                            isset($question['is_required']) ? ($question['is_required'] ? 1 : 0) : 1,
                            $qIndex + 1
                        ]);
                    }
                }
            }
        }
        
        $pdo->commit();
        jsonResponse(['id' => (int)$surveyId], 201, "สร้างแบบประเมินสำเร็จ");
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(null, 500, "เกิดข้อผิดพลาดในการสร้างแบบประเมิน: " . $e->getMessage());
    }
} elseif ($method === 'PUT') {
    requireAuth();
    $input = getJsonInput();
    $id = isset($input['id']) ? (int)$input['id'] : null;
    
    if (!$id) {
        jsonResponse(null, 400, "ไม่พบรหัสแบบประเมิน (Missing survey ID)");
    }
    
    $title = trim($input['title'] ?? '');
    if (empty($title)) {
        jsonResponse(null, 400, "กรุณาระบุชื่อแบบประเมิน");
    }
    
    try {
        $pdo->beginTransaction();
        
        // Update main survey record
        $stmt = $pdo->prepare("UPDATE surveys SET title = ?, category = ?, description = ?, status = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([
            $title,
            trim($input['category'] ?? 'ทั่วไป'),
            trim($input['description'] ?? ''),
            $input['status'] ?? 'draft',
            $id
        ]);
        
        // If sections are supplied, update all sections and questions
        if (isset($input['sections']) && is_array($input['sections'])) {
            // Delete old sections (cascades to questions in DB foreign key)
            $stmtDel = $pdo->prepare("DELETE FROM survey_sections WHERE survey_id = ?");
            $stmtDel->execute([$id]);
            
            // Insert updated sections & questions
            foreach ($input['sections'] as $sIndex => $section) {
                $secTitle = trim($section['title'] ?? ('ส่วนที่ ' . ($sIndex + 1)));
                $secType = $section['section_type'] ?? 'rating';
                
                $stmtSec = $pdo->prepare("INSERT INTO survey_sections (survey_id, title, section_type, sort_order) VALUES (?, ?, ?, ?)");
                $stmtSec->execute([$id, $secTitle, $secType, $sIndex + 1]);
                $sectionId = $pdo->lastInsertId();
                
                if (!empty($section['questions']) && is_array($section['questions'])) {
                    foreach ($section['questions'] as $qIndex => $question) {
                        $qText = trim($question['question_text'] ?? '');
                        if (empty($qText)) continue;
                        
                        $qDescription = trim($question['question_description'] ?? $question['description'] ?? '');
                        $qType = $question['question_type'] ?? 'rating';
                        $optionsJson = null;
                        if (!empty($question['options']) && is_array($question['options'])) {
                            $cleanOpts = array_values(array_filter(array_map('trim', $question['options'])));
                            if (!empty($cleanOpts)) {
                                $optionsJson = json_encode($cleanOpts, JSON_UNESCAPED_UNICODE);
                            }
                        }
                        
                        $stmtQ = $pdo->prepare("INSERT INTO survey_questions (section_id, question_text, question_description, question_type, options_json, is_required, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
                        $stmtQ->execute([
                            $sectionId, 
                            $qText, 
                            $qDescription,
                            $qType,
                            $optionsJson,
                            isset($question['is_required']) ? ($question['is_required'] ? 1 : 0) : 1,
                            $qIndex + 1
                        ]);
                    }
                }
            }
        }
        
        $pdo->commit();
        jsonResponse(['id' => $id], 200, "บันทึกการแก้ไขแบบประเมินสำเร็จ");
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(null, 500, "เกิดข้อผิดพลาดในการแก้ไขแบบประเมิน: " . $e->getMessage());
    }
} elseif ($method === 'PATCH') {
    requireAuth();
    $input = getJsonInput();
    $id = isset($input['id']) ? (int)$input['id'] : null;
    $status = $input['status'] ?? null;
    
    if (!$id || !$status) {
        jsonResponse(null, 400, "ข้อมูลไม่ครบถ้วน");
    }
    
    $stmt = $pdo->prepare("UPDATE surveys SET status = ?, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$status, $id]);
    jsonResponse(['id' => $id, 'status' => $status], 200, "อัปเดตสถานะสำเร็จ");
} elseif ($method === 'DELETE') {
    requireAuth();
    $input = getJsonInput();
    $id = isset($_GET['id']) ? (int)$_GET['id'] : (isset($input['id']) ? (int)$input['id'] : null);
    
    if (!$id) {
        jsonResponse(null, 400, "กรุณาระบุรหัสแบบประเมินที่ต้องการลบ");
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM surveys WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['id' => $id], 200, "ลบแบบประเมินเรียบร้อยแล้ว");
    } catch (Exception $e) {
        jsonResponse(null, 500, "ไม่สามารถลบแบบประเมินได้: " . $e->getMessage());
    }
} else {
    jsonResponse(null, 405, "Method not allowed");
}
