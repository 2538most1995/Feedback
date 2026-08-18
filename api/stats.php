<?php
// /Applications/MAMP/htdocs/Feedback/api/stats.php
require_once 'config.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') {
    jsonResponse(null, 405, "Method not allowed");
}

$type = $_GET['type'] ?? '';

if ($type === 'overview') {
    $stats = [];
    $stmt = $pdo->query("SELECT COUNT(*) as c FROM surveys");
    $stats['total_surveys'] = (int)$stmt->fetch()['c'];

    $stmt = $pdo->query("SELECT COUNT(*) as c FROM surveys WHERE status = 'published'");
    $stats['published_count'] = (int)$stmt->fetch()['c'];

    $stmt = $pdo->query("SELECT COUNT(*) as c FROM responses");
    $stats['total_responses'] = (int)$stmt->fetch()['c'];

    $stmt = $pdo->query("SELECT AVG(rating_value) as a FROM response_answers WHERE rating_value IS NOT NULL");
    $stats['avg_rating'] = round((float)$stmt->fetch()['a'], 2);

    // Rating distribution for donut chart
    $stmt = $pdo->query("SELECT rating_value, COUNT(*) as count FROM response_answers WHERE rating_value IS NOT NULL GROUP BY rating_value ORDER BY rating_value DESC");
    $distribution = [];
    foreach ($stmt->fetchAll() as $row) {
        $distribution[(string)$row['rating_value']] = (int)$row['count'];
    }
    $stats['rating_distribution'] = $distribution;

    jsonResponse($stats);
} elseif ($type === 'recent_surveys') {
    $stmt = $pdo->query("SELECT s.*, 
        (SELECT COUNT(*) FROM responses WHERE survey_id = s.id) as response_count,
        (SELECT ROUND(AVG(ra.rating_value), 2) FROM response_answers ra JOIN responses r ON ra.response_id = r.id WHERE r.survey_id = s.id AND ra.rating_value IS NOT NULL) as avg_rating
        FROM surveys s ORDER BY created_at DESC LIMIT 5");
    jsonResponse($stmt->fetchAll());
} elseif ($type === 'recent') {
    $stmt = $pdo->query("
        SELECT r.*, s.title as survey_title,
        (SELECT ROUND(AVG(ra.rating_value), 2) FROM response_answers ra WHERE ra.response_id = r.id AND ra.rating_value IS NOT NULL) as avg_rating
        FROM responses r 
        JOIN surveys s ON r.survey_id = s.id 
        ORDER BY r.submitted_at DESC LIMIT 10
    ");
    jsonResponse($stmt->fetchAll());
} elseif ($type === 'survey') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(null, 400, "Missing survey ID");

    $stats = [];

    // Survey info
    $stmt = $pdo->prepare("SELECT * FROM surveys WHERE id = ?");
    $stmt->execute([$id]);
    $stats['survey'] = $stmt->fetch();

    // Total responses
    $stmt = $pdo->prepare("SELECT COUNT(*) as c FROM responses WHERE survey_id = ?");
    $stmt->execute([$id]);
    $stats['total_responses'] = (int)$stmt->fetch()['c'];

    // Overall avg
    $stmt = $pdo->prepare("SELECT AVG(ra.rating_value) as a FROM response_answers ra JOIN responses r ON ra.response_id = r.id WHERE r.survey_id = ? AND ra.rating_value IS NOT NULL");
    $stmt->execute([$id]);
    $stats['avg_rating'] = round((float)$stmt->fetch()['a'], 2);

    // Avg per question
    $stmt = $pdo->prepare("SELECT q.id, q.question_text, 
        ROUND(AVG(ra.rating_value), 2) as avg_rating, 
        COUNT(ra.rating_value) as count,
        MIN(ra.rating_value) as min_rating,
        MAX(ra.rating_value) as max_rating,
        ROUND(STDDEV(ra.rating_value), 2) as std_dev
        FROM survey_questions q 
        LEFT JOIN response_answers ra ON q.id = ra.question_id 
        WHERE q.section_id IN (SELECT id FROM survey_sections WHERE survey_id = ?) AND q.question_type = 'rating'
        GROUP BY q.id, q.question_text
        ORDER BY q.sort_order");
    $stmt->execute([$id]);
    $stats['questions'] = $stmt->fetchAll();

    // Rating distribution
    $stmt = $pdo->prepare("SELECT ra.rating_value, COUNT(*) as count 
        FROM response_answers ra 
        JOIN responses r ON ra.response_id = r.id 
        WHERE r.survey_id = ? AND ra.rating_value IS NOT NULL 
        GROUP BY ra.rating_value ORDER BY ra.rating_value DESC");
    $stmt->execute([$id]);
    $distribution = [];
    foreach ($stmt->fetchAll() as $row) {
        $distribution[(string)$row['rating_value']] = (int)$row['count'];
    }
    $stats['distribution'] = $distribution;

    // Demographics
    $stmt = $pdo->prepare("SELECT gender, COUNT(*) as count FROM responses WHERE survey_id = ? AND gender != '' GROUP BY gender");
    $stmt->execute([$id]);
    $stats['gender'] = $stmt->fetchAll();

    $stmt = $pdo->prepare("SELECT age_range, COUNT(*) as count FROM responses WHERE survey_id = ? AND age_range != '' GROUP BY age_range");
    $stmt->execute([$id]);
    $stats['age_range'] = $stmt->fetchAll();

    $stmt = $pdo->prepare("SELECT role, COUNT(*) as count FROM responses WHERE survey_id = ? AND role != '' GROUP BY role");
    $stmt->execute([$id]);
    $stats['role'] = $stmt->fetchAll();

    // Text responses
    $stmt = $pdo->prepare("SELECT q.question_text, ra.text_value
        FROM response_answers ra
        JOIN survey_questions q ON ra.question_id = q.id
        JOIN responses r ON ra.response_id = r.id
        WHERE r.survey_id = ? AND ra.text_value IS NOT NULL AND ra.text_value != ''
        ORDER BY r.submitted_at DESC");
    $stmt->execute([$id]);
    $stats['text_responses'] = $stmt->fetchAll();

    jsonResponse($stats);
} elseif ($type === 'export') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(null, 400, "Missing survey ID");

    // Fetch survey
    $stmt = $pdo->prepare("SELECT * FROM surveys WHERE id = ?");
    $stmt->execute([$id]);
    $survey = $stmt->fetch();
    if (!$survey) jsonResponse(null, 404, "Survey not found");

    // Fetch rating questions to use as headers
    $stmt = $pdo->prepare("SELECT q.id, q.question_text, q.question_type 
        FROM survey_questions q 
        JOIN survey_sections ss ON q.section_id = ss.id 
        WHERE ss.survey_id = ? 
        ORDER BY ss.sort_order, q.sort_order");
    $stmt->execute([$id]);
    $questions = $stmt->fetchAll();

    // Fetch all responses
    $stmt = $pdo->prepare("SELECT * FROM responses WHERE survey_id = ? ORDER BY submitted_at ASC");
    $stmt->execute([$id]);
    $responses = $stmt->fetchAll();

    $exportData = [];
    foreach ($responses as $r) {
        $row = [
            'ลำดับ' => $r['id'],
            'วันที่ตอบ' => $r['submitted_at'],
            'เพศ' => $r['gender'],
            'อายุ' => $r['age_range'],
            'บทบาท' => $r['role']
        ];

        // Fetch all answers for this response
        $stmtA = $pdo->prepare("SELECT question_id, rating_value, text_value FROM response_answers WHERE response_id = ?");
        $stmtA->execute([$r['id']]);
        $answers = $stmtA->fetchAll();

        $ansMap = [];
        foreach ($answers as $a) {
            $ansMap[$a['question_id']] = $a['rating_value'] !== null ? $a['rating_value'] : $a['text_value'];
        }

        foreach ($questions as $q) {
            $row[$q['question_text']] = $ansMap[$q['id']] ?? '';
        }
        $exportData[] = $row;
    }

    // Calculate summary stats
    $summaryStats = [];
    foreach ($questions as $q) {
        if ($q['question_type'] === 'rating') {
            $vals = array_filter(array_column($exportData, $q['question_text']), function($v) { return $v !== '' && $v !== null; });
            if (count($vals) > 0) {
                $avg = array_sum($vals) / count($vals);
                $summaryStats[] = [
                    'question' => $q['question_text'],
                    'avg' => round($avg, 2),
                    'min' => min($vals),
                    'max' => max($vals),
                    'count' => count($vals)
                ];
            }
        }
    }

    jsonResponse([
        'survey' => $survey['title'],
        'data' => $exportData,
        'summary' => $summaryStats,
        'questions' => $questions
    ]);
} else {
    jsonResponse(null, 400, "Invalid stats type. Use: overview, recent, recent_surveys, survey, export");
}
?>
