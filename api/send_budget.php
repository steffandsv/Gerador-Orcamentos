<?php
require_once __DIR__ . '/../lib/Exception.php';
require_once __DIR__ . '/../lib/SMTP.php';
require_once __DIR__ . '/../lib/PHPMailer.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

// Ensure DB is connected (relies on being included from index.php usually, but if called via AJAX standalone?)
// If called via require in index.php, $pdo exists.
global $pdo; 
if (!$pdo) {
    if (file_exists(__DIR__ . '/../config.php')) {
        require_once __DIR__ . '/../config.php';
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro de configuração DB.']);
        exit;
    }
}

$quote_id = $_POST['quote_id'] ?? null;
$recipient = $_POST['recipient_email'] ?? '';

if (!$quote_id || !$recipient) {
    echo json_encode(['success' => false, 'message' => 'Dados incompletos.']);
    exit;
}

// Fetch Quote
$stmt = $pdo->prepare("SELECT * FROM orcamentos WHERE id = ?");
$stmt->execute([$quote_id]);
$quote = $stmt->fetch();

if (!$quote) {
    echo json_encode(['success' => false, 'message' => 'Orçamento não encontrado.']);
    exit;
}

// Fetch Company 1 (Sender)
$sender_id = $quote['empresa1_id'];
$stmt = $pdo->prepare("SELECT * FROM empresas WHERE id = ?");
$stmt->execute([$sender_id]);
$sender = $stmt->fetch();

if (!$sender) {
    echo json_encode(['success' => false, 'message' => 'Empresa remetente não encontrada.']);
    exit;
}

// Determine SMTP Settings
$host = $sender['smtp_host'] ?? '';
$user = $sender['smtp_user'] ?? '';
$pass = $sender['smtp_pass'] ?? '';
$port = $sender['smtp_port'] ?? 587;
$secure = $sender['smtp_secure'] ?? 'tls';

if (!$host || !$user || !$pass) {
    echo json_encode(['success' => false, 'message' => 'Configuração SMTP da empresa incompleta.']);
    exit;
}

// Random Content
$subjects = [
    "Orçamento Solicitado - " . $quote['titulo'],
    "Proposta Comercial: " . $quote['titulo'],
    "Envio de Orçamento Referente a " . $quote['titulo'],
    "Solicitação Atendida: " . $quote['titulo'],
    "Orçamento - Detalhes em Anexo (" . $quote['titulo'] . ")",
    "Re: Solicitação de Orçamento - " . $quote['titulo']
];

$bodies = [
    "<p>Prezados,</p><p>Conforme solicitado, seguem em anexo os orçamentos para análise.</p><p>Atenciosamente,</p><p><strong>" . $sender['nome'] . "</strong></p>",
    "<p>Olá,</p><p>Estamos enviando os orçamentos requisitados. Encontram-se no anexo deste e-mail.</p><p>Ficamos à disposição,</p><p><strong>" . $sender['nome'] . "</strong></p>",
    "<p>Bom dia/Boa tarde,</p><p>Segue a proposta comercial solicitada (anexa em PDF).</p><p>Grato,</p><p><strong>" . $sender['nome'] . "</strong></p>",
    "<p>Aos cuidados do Responsável,</p><p>Encaminhamos anexo a documentação referente ao orçamento solicitado.</p><p>Att,</p>",
    "<p>Prezado Cliente,</p><p>Conforme contato, segue orçamento atualizado.</p><p>Dúvidas estamos à disposição.</p>",
    "<p>Olá,</p><p>Aqui estão os orçamentos das empresas solicitadas.</p><p>Confira os anexos.</p>"
];

// Pick random
$subject = $subjects[array_rand($subjects)];
$body = $bodies[array_rand($bodies)];

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = $host;
    $mail->SMTPAuth   = true;
    $mail->Username   = $user;
    $mail->Password   = $pass;
    
    if ($secure === 'tls') $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    elseif ($secure === 'ssl') $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    else $mail->SMTPSecure = false;
    
    $mail->Port       = $port;
    $mail->CharSet    = 'UTF-8';

    // Recipients
    $mail->setFrom($user, $sender['nome']); // Assuming user is the sender email
    $mail->addAddress($recipient);

    // Content
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $body;

    // Attachments
    // Handle 'pdf1', 'pdf2', 'pdf3'
    $companies = ['Empresa Vencedora', 'Empresa 2', 'Empresa 3'];
    
    for ($i = 1; $i <= 3; $i++) {
        if (isset($_FILES['pdf' . $i]) && $_FILES['pdf' . $i]['error'] == 0) {
            $name = 'Orcamento_' . $i . '_' . preg_replace('/[^a-zA-Z0-9]/', '_', $quote['titulo']) . '.pdf';
            $mail->addAttachment($_FILES['pdf' . $i]['tmp_name'], $name);
        }
    }

    $mail->send();
    echo json_encode(['success' => true, 'message' => 'Orçamentos enviados com sucesso!']);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erro ao enviar: ' . $mail->ErrorInfo]);
}
