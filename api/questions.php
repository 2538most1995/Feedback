<?php
// /Applications/MAMP/htdocs/Feedback/api/questions.php
require_once 'config.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = getJsonInput();
    $type = $input['type'] ?? ''; // 'section' or 'question'
    
    if ($type === 'section') {
        $stmt = $pdo->prepare("INSERT INTO survey_sections (survey_id, title, section_type, sort_order) VALUES (?, ?, ?, ?)");
        $stmt->execute([
            $input['survey_id'],
            $input['title'],
            $input['section_type'] ?? 'rating',
            $input['sort_order'] ?? 0
        ]);
        jsonResponse(['id' => $pdo->lastInsertId()], 201, "Section created");
    } elseif ($type === 'question') {
        $stmt = $pdo->prepare("INSERT INTO survey_questions (section_id, question_text, question_description, question_type, options_json, is_required, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['section_id'],
            $input['question_text'],
            trim($input['question_description'] ?? $input['description'] ?? ''),
            $input['question_type'] ?? 'rating',
            isset($input['options']) ? json_encode($input['options']) : null,
            $input['is_required'] ?? 1,
            $input['sort_order'] ?? 0
        ]);
        jsonResponse(['id' => $pdo->lastInsertId()], 201, "Question created");
    } else {
        jsonResponse(null, 400, "Invalid type");
    }
} elseif ($method === 'PUT') {
    $input = getJsonInput();
    $type = $input['type'] ?? ''; 
    $id = $input['id'] ?? null;
    
    if (!$id) jsonResponse(null, 400, "Missing ID");
    
    if ($type === 'section') {
        $stmt = $pdo->prepare("UPDATE survey_sections SET title = ?, section_type = ? WHERE id = ?");
        $stmt->execute([$input['title'], $input['section_type'] ?? 'rating', $id]);
        jsonResponse(null, 200, "Section updated");
    } elseif ($type === 'question') {
        $stmt = $pdo->prepare("UPDATE survey_questions SET question_text = ?, question_description = ?, question_type = ?, options_json = ?, is_required = ? WHERE id = ?");
        $stmt->execute([
            $input['question_text'],
            trim($input['question_description'] ?? $input['description'] ?? ''),
            $input['question_type'] ?? 'rating',
            isset($input['options']) ? json_encode($input['options']) : null,
            $input['is_required'] ?? 1,
            $id
        ]);
        jsonResponse(null, 200, "Question updated");
    } else {
        jsonResponse(null, 400, "Invalid type");
    }
} elseif ($method === 'DELETE') {
    $input = getJsonInput();
    $type = $input['type'] ?? $_GET['type'] ?? '';
    $id = $input['id'] ?? $_GET['id'] ?? null;
    
    if (!$id) jsonResponse(null, 400, "Missing ID");
    
    if ($type === 'section') {
        $stmt = $pdo->prepare("DELETE FROM survey_sections WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(null, 200, "Section deleted");
    } elseif ($type === 'question') {
        $stmt = $pdo->prepare("DELETE FROM survey_questions WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(null, 200, "Question deleted");
    } else {
        jsonResponse(null, 400, "Invalid type");
    }
} elseif ($method === 'PATCH') {
    $input = getJsonInput();
    $type = $input['type'] ?? '';
    $items = $input['items'] ?? []; // [{id, sort_order}]
    
    if (empty($items)) jsonResponse(null, 400, "No items to reorder");
    
    $table = $type === 'section' ? 'survey_sections' : 'survey_questions';
    
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("UPDATE $table SET sort_order = ? WHERE id = ?");
        foreach ($items as $item) {
            $stmt->execute([$item['sort_order'], $item['id']]);
        }
        $pdo->commit();
        jsonResponse(null, 200, "Reordered successfully");
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(null, 500, "Error reordering: " . $e->getMessage());
    }
} else {
    jsonResponse(null, 405, "Method not allowed");
}
?>
