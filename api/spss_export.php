<?php
require_once 'config.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(null, 405, 'Method not allowed');
}

$surveyId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($surveyId <= 0) {
    jsonResponse(null, 400, 'กรุณาระบุแบบประเมินที่ต้องการส่งออก');
}

$autoloadPath = dirname(__DIR__) . '/vendor/autoload.php';
if (!is_file($autoloadPath)) {
    jsonResponse(null, 500, 'ยังไม่ได้ติดตั้งไลบรารีสำหรับสร้างไฟล์ SPSS');
}
require_once $autoloadPath;

use SPSS\Sav\Variable;
use SPSS\Sav\Writer;

const SPSS_SYSTEM_MISSING = -1.7976931348623157e+308;

/** ตัดข้อความตามจำนวนไบต์โดยไม่ทำให้อักขระ UTF-8 เสีย */
function spssByteTruncate(string $value, int $maxBytes): string
{
    if (strlen($value) <= $maxBytes) {
        return $value;
    }

    while ($maxBytes > 0 && (ord($value[$maxBytes]) & 0xC0) === 0x80) {
        $maxBytes--;
    }

    return substr($value, 0, $maxBytes);
}

function spssStringWidth(array $values, int $minimum = 8): int
{
    $width = $minimum;
    foreach ($values as $value) {
        $width = max($width, strlen((string) $value));
    }

    return min(32767, $width);
}

/**
 * แปลงข้อความหมวดหมู่เป็นรหัสตัวเลขพร้อม Value Labels สำหรับ SPSS
 *
 * @return array{data: array<int, int|null>, labels: array<int, string>}
 */
function spssEncodeCategories(array $values, array $preferredLabels = []): array
{
    $orderedLabels = [];
    foreach (array_merge($preferredLabels, $values) as $label) {
        $label = trim((string) $label);
        if ($label !== '' && !in_array($label, $orderedLabels, true)) {
            $orderedLabels[] = $label;
        }
    }

    $codeByLabel = [];
    $labels = [];
    foreach ($orderedLabels as $index => $label) {
        $code = $index + 1;
        $codeByLabel[$label] = $code;
        $labels[$code] = spssByteTruncate($label, 240);
    }

    $data = [];
    foreach ($values as $value) {
        $value = trim((string) $value);
        $data[] = $value === '' ? null : ($codeByLabel[$value] ?? null);
    }

    return ['data' => $data, 'labels' => $labels];
}

function spssNumericVariable(string $name, string $label, array $data, int $measure, array $valueLabels = [], int $format = Variable::FORMAT_TYPE_F, int $width = 12): array
{
    $data = array_map(static fn($value) => $value === null || $value === '' ? SPSS_SYSTEM_MISSING : $value, $data);

    return [
        'name' => $name,
        'format' => $format,
        'width' => $width,
        'decimals' => 0,
        'label' => spssByteTruncate($label, 240),
        'values' => $valueLabels,
        'columns' => min(40, max(8, $width)),
        'alignment' => Variable::ALIGN_RIGHT,
        'measure' => $measure,
        'data' => $data,
    ];
}

function spssTextVariable(string $name, string $label, array $values, int $minimumWidth = 8): array
{
    $width = spssStringWidth($values, $minimumWidth);
    $data = array_map(static fn($value) => spssByteTruncate((string) $value, $width), $values);

    return [
        'name' => $name,
        'format' => Variable::FORMAT_TYPE_A,
        'width' => $width,
        'label' => spssByteTruncate($label, 240),
        'columns' => min(80, max(12, $width)),
        'alignment' => Variable::ALIGN_LEFT,
        'measure' => Variable::MEASURE_NOMINAL,
        'data' => $data,
    ];
}

try {
    $stmt = $pdo->prepare('SELECT id, title FROM surveys WHERE id = ?');
    $stmt->execute([$surveyId]);
    $survey = $stmt->fetch();
    if (!$survey) {
        jsonResponse(null, 404, 'ไม่พบแบบประเมินที่ระบุ');
    }

    $stmt = $pdo->prepare("SELECT q.id, q.question_text, q.question_type, q.options_json, ss.title AS section_title
        FROM survey_questions q
        JOIN survey_sections ss ON q.section_id = ss.id
        WHERE ss.survey_id = ?
        ORDER BY ss.sort_order, q.sort_order, q.id");
    $stmt->execute([$surveyId]);
    $questions = $stmt->fetchAll();

    $stmt = $pdo->prepare('SELECT id, respondent_name, gender, age_range, role, submitted_at FROM responses WHERE survey_id = ? ORDER BY submitted_at, id');
    $stmt->execute([$surveyId]);
    $responses = $stmt->fetchAll();

    $answersByResponse = [];
    if ($responses) {
        $responseIds = array_column($responses, 'id');
        $placeholders = implode(',', array_fill(0, count($responseIds), '?'));
        $stmt = $pdo->prepare("SELECT response_id, question_id, rating_value, text_value FROM response_answers WHERE response_id IN ($placeholders)");
        $stmt->execute($responseIds);
        foreach ($stmt->fetchAll() as $answer) {
            $answersByResponse[(int) $answer['response_id']][(int) $answer['question_id']] = $answer;
        }
    }

    $ids = array_map(static fn($row) => (int) $row['id'], $responses);
    $submittedDates = array_map(static function ($row) {
        $timestamp = strtotime((string) $row['submitted_at']);
        return $timestamp === false ? null : $timestamp + 12219379200;
    }, $responses);
    $names = array_column($responses, 'respondent_name');
    $genders = array_column($responses, 'gender');
    $ages = array_column($responses, 'age_range');
    $roles = array_column($responses, 'role');

    $genderEncoded = spssEncodeCategories($genders, ['ชาย', 'หญิง', 'อื่นๆ', 'ไม่ระบุ']);
    $ageEncoded = spssEncodeCategories($ages);
    $roleEncoded = spssEncodeCategories($roles);

    $variables = [
        spssNumericVariable('ID', 'รหัสคำตอบ', $ids, Variable::MEASURE_NOMINAL),
        spssNumericVariable('SUBMIT_DT', 'วันที่และเวลาที่ตอบแบบประเมิน', $submittedDates, Variable::MEASURE_SCALE, [], Variable::FORMAT_TYPE_DATETIME, 20),
        spssTextVariable('NAME', 'ชื่อผู้ตอบแบบประเมิน', $names, 24),
        spssNumericVariable('GENDER', 'เพศ', $genderEncoded['data'], Variable::MEASURE_NOMINAL, $genderEncoded['labels']),
        spssNumericVariable('AGE', 'ช่วงอายุ', $ageEncoded['data'], Variable::MEASURE_ORDINAL, $ageEncoded['labels']),
        spssNumericVariable('ROLE', 'บทบาท/สถานะ', $roleEncoded['data'], Variable::MEASURE_NOMINAL, $roleEncoded['labels']),
    ];

    $ratingLabels = [
        1 => 'น้อยที่สุด',
        2 => 'น้อย',
        3 => 'ปานกลาง',
        4 => 'มาก',
        5 => 'มากที่สุด',
    ];

    foreach ($questions as $questionIndex => $question) {
        $questionNumber = $questionIndex + 1;
        $variableName = sprintf('Q%02d', $questionNumber);
        $questionId = (int) $question['id'];
        $questionLabel = trim((string) $question['section_title']) . ': ' . trim((string) $question['question_text']);
        $questionType = (string) $question['question_type'];
        $values = [];

        foreach ($responses as $response) {
            $answer = $answersByResponse[(int) $response['id']][$questionId] ?? null;
            $values[] = $answer === null
                ? null
                : ($answer['rating_value'] !== null ? (int) $answer['rating_value'] : (string) ($answer['text_value'] ?? ''));
        }

        if ($questionType === 'rating') {
            $variables[] = spssNumericVariable($variableName, $questionLabel, $values, Variable::MEASURE_ORDINAL, $ratingLabels, Variable::FORMAT_TYPE_F, 8);
            continue;
        }

        $options = json_decode((string) ($question['options_json'] ?? ''), true);
        $options = is_array($options) ? array_values(array_map('strval', $options)) : [];

        if ($questionType === 'radio') {
            $encoded = spssEncodeCategories($values, $options);
            $variables[] = spssNumericVariable($variableName, $questionLabel, $encoded['data'], Variable::MEASURE_NOMINAL, $encoded['labels']);
            continue;
        }

        if ($questionType === 'checkbox') {
            if (!$options) {
                foreach ($values as $value) {
                    foreach (array_filter(array_map('trim', explode(', ', (string) $value))) as $selected) {
                        if (!in_array($selected, $options, true)) {
                            $options[] = $selected;
                        }
                    }
                }
            }

            foreach ($options as $optionIndex => $option) {
                $binaryData = array_map(static function ($value) use ($option) {
                    $selected = array_filter(array_map('trim', explode(', ', (string) $value)));
                    return in_array($option, $selected, true) ? 1 : 0;
                }, $values);
                $variables[] = spssNumericVariable(
                    sprintf('%s_%02d', $variableName, $optionIndex + 1),
                    $questionLabel . ' [' . $option . ']',
                    $binaryData,
                    Variable::MEASURE_NOMINAL,
                    [0 => 'ไม่เลือก', 1 => 'เลือก'],
                    Variable::FORMAT_TYPE_F,
                    8
                );
            }
            continue;
        }

        $variables[] = spssTextVariable($variableName, $questionLabel, $values, 40);
    }

    $writer = new Writer([
        'header' => [
            'prodName' => '@(#) Feedback Survey SPSS Export',
            'creationDate' => date('d M y'),
            'creationTime' => date('H:i:s'),
            'weightIndex' => 0,
            'fileLabel' => spssByteTruncate((string) $survey['title'], 60),
        ],
        'info' => ['characterEncoding' => 'UTF-8'],
        'documents' => [
            'สร้างจากระบบประเมินความพึงพอใจ เมื่อ ' . date('Y-m-d H:i:s'),
            'ตัวแปรคะแนน Qxx: 1=น้อยที่สุด ถึง 5=มากที่สุด; ตัวแปรคำถามหลายตัวเลือก Qxx_nn: 0=ไม่เลือก, 1=เลือก',
        ],
        'variables' => $variables,
    ]);

    $tempPath = tempnam(sys_get_temp_dir(), 'feedback_spss_');
    if ($tempPath === false || $writer->save($tempPath) === false) {
        throw new RuntimeException('ไม่สามารถสร้างไฟล์ SPSS ได้');
    }
    $writer->close();

    $fallbackName = 'survey_' . $surveyId . '_' . date('Y-m-d') . '.sav';
    $downloadName = 'SPSS_' . preg_replace('/[^a-zA-Z0-9ก-๙_-]+/u', '_', (string) $survey['title']) . '_' . date('Y-m-d') . '.sav';

    session_write_close();
    header('Content-Type: application/x-spss-sav');
    header('Content-Disposition: attachment; filename="' . $fallbackName . '"; filename*=UTF-8\'\'' . rawurlencode($downloadName));
    header('Content-Length: ' . filesize($tempPath));
    header('Cache-Control: private, no-store, max-age=0');
    readfile($tempPath);
    unlink($tempPath);
    exit;
} catch (Throwable $error) {
    if (isset($tempPath) && is_string($tempPath) && is_file($tempPath)) {
        unlink($tempPath);
    }
    error_log('SPSS export error: ' . $error->getMessage());
    jsonResponse(null, 500, 'เกิดข้อผิดพลาดในการสร้างไฟล์ SPSS');
}
