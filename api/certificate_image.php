<?php
// Temporary, unguessable certificate image bridge for LINE in-app browser.
// Images expire automatically and are served inline so Safari/Chrome can save them.

session_start();

const CERT_IMAGE_MAX_BYTES = 25165824; // 24 MB
const CERT_IMAGE_TTL = 86400; // 24 hours

$storageDir = dirname(__DIR__) . '/storage/certificate_exports';

function certificateImageJson($data, int $status, string $message): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');
    echo json_encode([
        'success' => $status >= 200 && $status < 300,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function cleanupExpiredCertificateImages(string $directory): void {
    if (!is_dir($directory)) return;
    $expiresBefore = time() - CERT_IMAGE_TTL;
    foreach (glob($directory . '/*.png') ?: [] as $file) {
        if (is_file($file) && filemtime($file) < $expiresBefore) {
            @unlink($file);
        }
    }
}

function safeCertificateFilename(string $name): string {
    $name = trim(preg_replace('/[\\x00-\\x1F\\x7F\\\\\/\"\']+/u', '_', $name));
    if ($name === '') $name = 'Certificate.png';
    if (!preg_match('/\\.png$/i', $name)) $name .= '.png';
    return function_exists('mb_substr') ? mb_substr($name, 0, 160) : substr($name, 0, 160);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $token = strtolower(trim($_GET['token'] ?? ''));
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        http_response_code(404);
        exit;
    }

    $file = $storageDir . '/' . $token . '.png';
    if (!is_file($file)) {
        http_response_code(404);
        exit;
    }
    if (filemtime($file) < time() - CERT_IMAGE_TTL) {
        @unlink($file);
        http_response_code(410);
        exit;
    }

    $downloadName = safeCertificateFilename($_GET['name'] ?? 'Certificate.png');
    header('Content-Type: image/png');
    header('Content-Length: ' . filesize($file));
    header('Content-Disposition: inline; filename="Certificate.png"; filename*=UTF-8\'\'' . rawurlencode($downloadName));
    header('Cache-Control: private, max-age=3600');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
}

if ($method !== 'POST') {
    certificateImageJson(null, 405, 'Method not allowed');
}

$now = time();
$recentExports = array_values(array_filter(
    $_SESSION['certificate_image_exports'] ?? [],
    static fn($timestamp) => is_int($timestamp) && $timestamp > $now - 600
));
if (count($recentExports) >= 12) {
    certificateImageJson(null, 429, 'สร้างลิงก์รูปภาพบ่อยเกินไป กรุณารอสักครู่');
}

$contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
$rawInput = file_get_contents('php://input');
$name = 'Certificate.png';

if ($contentType === 'image/png') {
    $binary = $rawInput;
    $encodedName = $_SERVER['HTTP_X_CERTIFICATE_FILENAME'] ?? '';
    if ($encodedName !== '') $name = rawurldecode($encodedName);
} else {
    // JSON data URLs remain supported for older cached clients.
    $input = json_decode($rawInput, true);
    $imageData = is_array($input) ? ($input['image_data'] ?? '') : '';
    if (!is_string($imageData) || !preg_match('/^data:image\/png;base64,([A-Za-z0-9+\/=\r\n]+)$/', $imageData, $matches)) {
        certificateImageJson(null, 400, 'ข้อมูลรูปภาพไม่ถูกต้อง');
    }
    $binary = base64_decode(str_replace(["\r", "\n"], '', $matches[1]), true);
    $name = is_array($input) ? ($input['filename'] ?? 'Certificate.png') : 'Certificate.png';
}

if ($binary === false || strlen($binary) === 0 || strlen($binary) > CERT_IMAGE_MAX_BYTES) {
    certificateImageJson(null, 413, 'รูปภาพมีขนาดใหญ่เกินกำหนด');
}
if (substr($binary, 0, 8) !== "\x89PNG\r\n\x1a\n") {
    certificateImageJson(null, 400, 'ไฟล์ต้องเป็นรูปภาพ PNG');
}

if (!is_dir($storageDir) && !mkdir($storageDir, 0750, true) && !is_dir($storageDir)) {
    certificateImageJson(null, 500, 'ไม่สามารถเตรียมพื้นที่เก็บรูปภาพชั่วคราวได้');
}
cleanupExpiredCertificateImages($storageDir);

$token = bin2hex(random_bytes(32));
$target = $storageDir . '/' . $token . '.png';
if (file_put_contents($target, $binary, LOCK_EX) === false) {
    certificateImageJson(null, 500, 'ไม่สามารถบันทึกรูปภาพชั่วคราวได้');
}
@chmod($target, 0640);

$recentExports[] = $now;
$_SESSION['certificate_image_exports'] = $recentExports;
$name = safeCertificateFilename($name);
$url = 'api/certificate_image.php?token=' . $token . '&name=' . rawurlencode($name);

certificateImageJson([
    'url' => $url,
    'expires_in' => CERT_IMAGE_TTL
], 201, 'สร้างลิงก์รูปภาพชั่วคราวแล้ว');
