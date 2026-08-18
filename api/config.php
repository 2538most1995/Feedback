<?php
// /Applications/MAMP/htdocs/Feedback/api/config.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 1. โหลดค่าจากไฟล์ .env หากมี (ทั้งในรูทและใน api/)
$envPaths = [__DIR__ . '/.env', __DIR__ . '/../.env'];
foreach ($envPaths as $envPath) {
    if (file_exists($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, '#') === 0) continue;
            if (strpos($line, '=') !== false) {
                list($envKey, $envVal) = explode('=', $line, 2);
                $envKey = trim($envKey);
                $envVal = trim(trim($envVal), "\"'");
                putenv("$envKey=$envVal");
                $_ENV[$envKey] = $envVal;
                $_SERVER[$envKey] = $envVal;
            }
        }
    }
}

// 2. โหลดไฟล์ config.local.php หากมี (ไฟล์นี้อยู่ใน .gitignore จะไม่ถูก Git บันทึกหรือดึงทับบน Server)
if (file_exists(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
} elseif (file_exists(__DIR__ . '/../config.local.php')) {
    require_once __DIR__ . '/../config.local.php';
}

// 3. ตรวจสอบสภาพแวดล้อม (Local MAMP vs Live Server)
$isLocalhost = (php_sapi_name() === 'cli')
            || in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost', '127.0.0.1', 'localhost:8888', 'localhost:80', 'localhost:8080']) 
            || strpos($_SERVER['HTTP_HOST'] ?? '', '127.0.0.1') !== false
            || strpos($_SERVER['HTTP_HOST'] ?? '', '.local') !== false
            || file_exists('/Applications/MAMP');

// ค่าเริ่มต้น (ถ้ายังไม่ได้กำหนดใน config.local.php หรือ getenv)
if (!isset($host)) {
    $host = getenv('DB_HOST') ?: ($isLocalhost ? '127.0.0.1' : 'localhost');
}
if (!isset($db)) {
    $db = getenv('DB_NAME') ?: 'feedback_system';
}
if (!isset($user)) {
    $user = getenv('DB_USER') ?: 'root';
}
if (!isset($pass)) {
    $pass = getenv('DB_PASS') !== false && getenv('DB_PASS') !== null ? getenv('DB_PASS') : ($isLocalhost ? 'root' : '');
}
if (!isset($port)) {
    $port = getenv('DB_PORT') ?: ($isLocalhost ? '8889' : '3306');
}
if (!isset($socket)) {
    $socket = getenv('DB_SOCKET') ?: ($isLocalhost ? '/Applications/MAMP/tmp/mysql/mysql.sock' : '');
}

$pdo = null;
$dsns = [];

if (!empty($socket) && file_exists($socket)) {
    $dsns[] = "mysql:unix_socket=$socket;dbname=$db;charset=utf8mb4";
}

$dsns[] = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
$dsns[] = "mysql:host=$host;dbname=$db;charset=utf8mb4";
$dsns[] = "mysql:host=localhost;port=3306;dbname=$db;charset=utf8mb4";
$dsns[] = "mysql:host=127.0.0.1;port=3306;dbname=$db;charset=utf8mb4";
$dsns[] = "mysql:host=localhost;port=8889;dbname=$db;charset=utf8mb4";

$lastError = '';
foreach ($dsns as $dsn) {
    try {
        $pdo = new PDO($dsn, $user, $pass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        break;
    } catch (PDOException $e) {
        $lastError = $e->getMessage();
    }
}

if (!$pdo) {
    jsonResponse(null, 500, "Database connection failed: " . $lastError);
}

function jsonResponse($data, $statusCode = 200, $message = '') {
    http_response_code($statusCode);
    echo json_encode([
        'success' => $statusCode >= 200 && $statusCode < 300,
        'message' => $message,
        'data' => $data
    ]);
    exit();
}

function getJsonInput() {
    return json_decode(file_get_contents('php://input'), true);
}

function requireAuth() {
    if (!isset($_SESSION['admin_id'])) {
        jsonResponse(null, 401, "Unauthorized");
    }
}
?>
