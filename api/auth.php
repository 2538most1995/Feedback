<?php
// /Applications/MAMP/htdocs/Feedback/api/auth.php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $input = getJsonInput();
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM admins WHERE username = ?");
    $stmt->execute([$username]);
    $admin = $stmt->fetch();

    if ($admin && password_verify($password, $admin['password_hash'])) {
        $_SESSION['admin_id'] = $admin['id'];
        $_SESSION['admin_username'] = $admin['username'];
        $_SESSION['admin_fullname'] = $admin['fullname'];
        jsonResponse([
            'id' => $admin['id'],
            'username' => $admin['username'],
            'fullname' => $admin['fullname']
        ], 200, "Login successful");
    } else {
        jsonResponse(null, 401, "Invalid username or password");
    }
} elseif ($method === 'DELETE') {
    session_destroy();
    jsonResponse(null, 200, "Logout successful");
} elseif ($method === 'GET') {
    if (isset($_SESSION['admin_id'])) {
        jsonResponse([
            'id' => $_SESSION['admin_id'],
            'username' => $_SESSION['admin_username'],
            'fullname' => $_SESSION['admin_fullname']
        ]);
    } else {
        jsonResponse(null, 401, "Not logged in");
    }
} else {
    jsonResponse(null, 405, "Method not allowed");
}
?>
