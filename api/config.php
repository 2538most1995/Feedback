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

$host = '127.0.0.1';
$db = 'feedback_system';
$user = 'root';
$pass = 'root';
$port = '8889';
$socket = '/Applications/MAMP/tmp/mysql/mysql.sock';

$pdo = null;
$dsns = [
    "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4",
    "mysql:unix_socket=$socket;dbname=$db;charset=utf8mb4",
    "mysql:host=localhost;port=3306;dbname=$db;charset=utf8mb4",
    "mysql:host=127.0.0.1;port=3306;dbname=$db;charset=utf8mb4",
    "mysql:host=localhost;port=$port;dbname=$db;charset=utf8mb4"
];

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
