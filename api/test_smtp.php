<?php
require_once __DIR__ . '/../lib/Exception.php';
require_once __DIR__ . '/../lib/SMTP.php';
require_once __DIR__ . '/../lib/PHPMailer.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

$host = $_POST['host'] ?? '';
$port = $_POST['port'] ?? 587;
$user = $_POST['user'] ?? '';
$pass = $_POST['pass'] ?? '';
$secure = $_POST['secure'] ?? 'tls';

if (!$host || !$user || !$pass) {
    echo json_encode(['success' => false, 'message' => 'Preencha todos os campos obrigatórios.']);
    exit;
}

$mail = new PHPMailer(true);

try {
    // Server settings
    $mail->SMTPDebug = SMTP::DEBUG_OFF; // Enable verbose debug output
    $mail->isSMTP();
    $mail->Host       = $host;
    $mail->SMTPAuth   = true;
    $mail->Username   = $user;
    $mail->Password   = $pass;
    
    // Encryption
    if ($secure === 'tls') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    } elseif ($secure === 'ssl') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    } else {
        $mail->SMTPSecure = false;
        $mail->SMTPAutoTLS = false;
    }
    
    $mail->Port       = $port;
    $mail->Timeout    = 10; // 10 seconds timeout

    // Test Connection
    if ($mail->smtpConnect()) {
        $mail->smtpClose();
        echo json_encode(['success' => true, 'message' => 'Conexão SMTP realizada com sucesso!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Falha ao conectar no servidor SMTP.']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erro: ' . $mail->ErrorInfo . ' (Exp: ' . $e->getMessage() . ')']);
}
