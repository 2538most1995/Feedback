<?php
// /Applications/MAMP/htdocs/Feedback/api/users.php
require_once 'config.php';

// Ensure admins table exists with proper structure
function checkHasRoleColumn($pdo) {
    static $hasRole = null;
    if ($hasRole !== null) return $hasRole;
    try {
        $colCheck = $pdo->query("SHOW COLUMNS FROM admins LIKE 'role'");
        if ($colCheck && $colCheck->fetch()) {
            $hasRole = true;
            return true;
        }
        $pdo->exec("ALTER TABLE admins ADD COLUMN role VARCHAR(50) DEFAULT 'admin'");
        $hasRole = true;
        return true;
    } catch (Exception $e) {
        $hasRole = false;
        return false;
    }
}

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // List all admins
    try {
        $hasRole = checkHasRoleColumn($pdo);
        $sql = $hasRole 
            ? "SELECT id, username, fullname, role, created_at FROM admins ORDER BY id ASC"
            : "SELECT id, username, fullname, 'admin' as role, created_at FROM admins ORDER BY id ASC";
            
        $stmt = $pdo->query($sql);
        $users = $stmt->fetchAll();
        
        // Add flag indicating if user is the currently logged in admin
        $currentAdminId = (int)($_SESSION['admin_id'] ?? 0);
        foreach ($users as &$u) {
            $u['is_current'] = ((int)$u['id'] === $currentAdminId);
            if (!isset($u['role']) || empty($u['role'])) {
                $u['role'] = 'admin';
            }
        }
        
        jsonResponse($users, 200, "ดึงข้อมูลผู้ดูแลระบบสำเร็จ");
    } catch (Exception $e) {
        jsonResponse(null, 500, "เกิดข้อผิดพลาดในการดึงข้อมูล: " . $e->getMessage());
    }
} elseif ($method === 'POST') {
    // Add new admin user
    $input = getJsonInput();
    $username = trim($input['username'] ?? '');
    $fullname = trim($input['fullname'] ?? '');
    $password = $input['password'] ?? '';
    $role = trim($input['role'] ?? 'admin');

    if (empty($username) || strlen($username) < 3) {
        jsonResponse(null, 400, "ชื่อผู้ใช้งาน (Username) ต้องมีอย่างน้อย 3 ตัวอักษร");
    }

    if (!preg_match('/^[a-zA-Z0-9_.-]+$/', $username)) {
        jsonResponse(null, 400, "ชื่อผู้ใช้งานต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข หรือขีดล่าง (_) เท่านั้น");
    }

    if (empty($fullname)) {
        jsonResponse(null, 400, "กรุณาระบุชื่อ-นามสกุล");
    }

    if (empty($password) || strlen($password) < 6) {
        jsonResponse(null, 400, "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
    }

    try {
        // Check if username already exists
        $stmtCheck = $pdo->prepare("SELECT id FROM admins WHERE username = ?");
        $stmtCheck->execute([$username]);
        if ($stmtCheck->fetch()) {
            jsonResponse(null, 400, "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว กรุณาเลือกชื่ออื่น");
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $hasRole = checkHasRoleColumn($pdo);

        if ($hasRole) {
            $stmt = $pdo->prepare("INSERT INTO admins (username, password_hash, fullname, role) VALUES (?, ?, ?, ?)");
            $stmt->execute([$username, $passwordHash, $fullname, $role]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO admins (username, password_hash, fullname) VALUES (?, ?, ?)");
            $stmt->execute([$username, $passwordHash, $fullname]);
        }
        $newId = $pdo->lastInsertId();

        jsonResponse([
            'id' => $newId,
            'username' => $username,
            'fullname' => $fullname,
            'role' => $role
        ], 201, "เพิ่มผู้ดูแลระบบเรียบร้อยแล้ว");
    } catch (Exception $e) {
        jsonResponse(null, 500, "เกิดข้อผิดพลาดในการเพิ่มผู้ดูแล: " . $e->getMessage());
    }
} elseif ($method === 'PUT') {
    $input = getJsonInput();
    $action = $input['action'] ?? 'change_password';
    $currentAdminId = (int)$_SESSION['admin_id'];

    if ($action === 'change_password' || $action === 'my_profile') {
        // Logged-in admin changing their own password or fullname
        $fullname = trim($input['fullname'] ?? '');
        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';

        if (empty($fullname)) {
            jsonResponse(null, 400, "กรุณาระบุชื่อ-นามสกุล");
        }

        try {
            // Fetch current user from DB
            $stmt = $pdo->prepare("SELECT * FROM admins WHERE id = ?");
            $stmt->execute([$currentAdminId]);
            $user = $stmt->fetch();

            if (!$user) {
                jsonResponse(null, 404, "ไม่พบข้อมูลผู้ใช้ในระบบ");
            }

            // If updating password
            if (!empty($newPassword)) {
                if (empty($currentPassword)) {
                    jsonResponse(null, 400, "กรุณาระบุรหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยนรหัสผ่าน");
                }

                if (!password_verify($currentPassword, $user['password_hash'])) {
                    jsonResponse(null, 400, "รหัสผ่านปัจจุบันไม่ถูกต้อง");
                }

                if (strlen($newPassword) < 6) {
                    jsonResponse(null, 400, "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
                }

                $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
                $stmtUpdate = $pdo->prepare("UPDATE admins SET fullname = ?, password_hash = ? WHERE id = ?");
                $stmtUpdate->execute([$fullname, $newHash, $currentAdminId]);
            } else {
                // Update fullname only
                $stmtUpdate = $pdo->prepare("UPDATE admins SET fullname = ? WHERE id = ?");
                $stmtUpdate->execute([$fullname, $currentAdminId]);
            }

            $_SESSION['admin_fullname'] = $fullname;

            jsonResponse([
                'id' => $currentAdminId,
                'username' => $user['username'],
                'fullname' => $fullname
            ], 200, "บันทึกการเปลี่ยนแปลงข้อมูลสำเร็จ");
        } catch (Exception $e) {
            jsonResponse(null, 500, "เกิดข้อผิดพลาดในการแก้ไขข้อมูล: " . $e->getMessage());
        }
    } elseif ($action === 'admin_reset_password' || $action === 'update_user') {
        // Admin resetting password or info for another user
        $targetUserId = isset($input['user_id']) ? (int)$input['user_id'] : null;
        $fullname = trim($input['fullname'] ?? '');
        $newPassword = $input['new_password'] ?? '';
        $role = trim($input['role'] ?? 'admin');

        if (!$targetUserId) {
            jsonResponse(null, 400, "กรุณาระบุ user_id ของผู้ใช้ที่ต้องการแก้ไข");
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM admins WHERE id = ?");
            $stmt->execute([$targetUserId]);
            $targetUser = $stmt->fetch();

            if (!$targetUser) {
                jsonResponse(null, 404, "ไม่พบข้อมูลผู้ใช้ที่ระบุ");
            }

            $hasRole = checkHasRoleColumn($pdo);

            if (!empty($newPassword)) {
                if (strlen($newPassword) < 6) {
                    jsonResponse(null, 400, "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
                }
                $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
                if ($hasRole) {
                    $stmtUpdate = $pdo->prepare("UPDATE admins SET fullname = ?, role = ?, password_hash = ? WHERE id = ?");
                    $stmtUpdate->execute([$fullname ?: $targetUser['fullname'], $role, $newHash, $targetUserId]);
                } else {
                    $stmtUpdate = $pdo->prepare("UPDATE admins SET fullname = ?, password_hash = ? WHERE id = ?");
                    $stmtUpdate->execute([$fullname ?: $targetUser['fullname'], $newHash, $targetUserId]);
                }
            } else {
                if ($hasRole) {
                    $stmtUpdate = $pdo->prepare("UPDATE admins SET fullname = ?, role = ? WHERE id = ?");
                    $stmtUpdate->execute([$fullname ?: $targetUser['fullname'], $role, $targetUserId]);
                } else {
                    $stmtUpdate = $pdo->prepare("UPDATE admins SET fullname = ? WHERE id = ?");
                    $stmtUpdate->execute([$fullname ?: $targetUser['fullname'], $targetUserId]);
                }
            }

            if ($targetUserId === $currentAdminId && !empty($fullname)) {
                $_SESSION['admin_fullname'] = $fullname;
            }

            jsonResponse([
                'id' => $targetUserId,
                'username' => $targetUser['username'],
                'fullname' => $fullname ?: $targetUser['fullname'],
                'role' => $role
            ], 200, "แก้ไขข้อมูลผู้ดูแลระบบสำเร็จ");
        } catch (Exception $e) {
            jsonResponse(null, 500, "เกิดข้อผิดพลาดในการแก้ไขข้อมูล: " . $e->getMessage());
        }
    } else {
        jsonResponse(null, 400, "ไม่พบคำสั่ง action ที่ระบุ");
    }
} elseif ($method === 'DELETE') {
    // Delete admin user
    $targetUserId = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $currentAdminId = (int)$_SESSION['admin_id'];

    if (!$targetUserId) {
        jsonResponse(null, 400, "กรุณาระบุ ID ของผู้ดูแลระบบที่ต้องการลบ");
    }

    if ($targetUserId === $currentAdminId) {
        jsonResponse(null, 400, "ไม่สามารถลบบัญชีผู้ใช้ที่กำลังเข้าสู่ระบบอยู่ในขณะนี้ได้");
    }

    try {
        // Check remaining admins count
        $stmtCount = $pdo->query("SELECT COUNT(*) FROM admins");
        $totalAdmins = (int)$stmtCount->fetchColumn();

        if ($totalAdmins <= 1) {
            jsonResponse(null, 400, "ไม่สามารถลบได้ เนื่องจากต้องมีผู้ดูแลระบบคงเหลืออยู่อย่างน้อย 1 บัญชี");
        }

        $stmt = $pdo->prepare("DELETE FROM admins WHERE id = ?");
        $stmt->execute([$targetUserId]);

        jsonResponse(null, 200, "ลบผู้ดูแลระบบเรียบร้อยแล้ว");
    } catch (Exception $e) {
        jsonResponse(null, 500, "เกิดข้อผิดพลาดในการลบ: " . $e->getMessage());
    }
} else {
    jsonResponse(null, 405, "Method not allowed");
}
