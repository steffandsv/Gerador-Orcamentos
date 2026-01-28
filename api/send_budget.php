<?php
require_once __DIR__ . '/../lib/Exception.php';
require_once __DIR__ . '/../lib/SMTP.php';
require_once __DIR__ . '/../lib/PHPMailer.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

// Ensure DB is connected
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

$results = [];
$successCount = 0;

// Content Variations
$subjects = [
    "Orçamento Solicitado - " . $quote['titulo'],
    "Proposta Comercial: " . $quote['titulo'],
    "Envio de Orçamento Referente a " . $quote['titulo'],
    "Solicitação Atendida: " . $quote['titulo'],
    "Orçamento - Detalhes em Anexo (" . $quote['titulo'] . ")",
    "Re: Solicitação de Orçamento - " . $quote['titulo'],
    "Cotação de Preços - " . $quote['titulo'],
    "Resposta ao pedido de orçamento - " . $quote['titulo']
];

$bodies = [
    "<p>Prezados,</p><p>Conforme solicitado, seguem em anexo os orçamentos para análise.</p><p>Atenciosamente,</p><p><strong>%COMPANY_NAME%</strong></p>",
    "<p>Olá,</p><p>Estamos enviando os orçamentos requisitados. Encontram-se no anexo deste e-mail.</p><p>Ficamos à disposição,</p><p><strong>%COMPANY_NAME%</strong></p>",
    "<p>Bom dia/Boa tarde,</p><p>Segue a proposta comercial solicitada (anexa em PDF).</p><p>Grato,</p><p><strong>%COMPANY_NAME%</strong></p>",
    "<p>Aos cuidados do Responsável,</p><p>Encaminhamos anexo a documentação referente ao orçamento solicitado.</p><p>Att,</p><p><strong>%COMPANY_NAME%</strong></p>",
    "<p>Prezado Cliente,</p><p>Conforme contato, segue orçamento atualizado.</p><p>Dúvidas estamos à disposição.</p><p><strong>%COMPANY_NAME%</strong></p>",
    "<p>Olá,</p><p>Aqui estão os orçamentos solicitados.</p><p>Confira o anexo.</p><p>Att,</p><p><strong>%COMPANY_NAME%</strong></p>"
];

// Loop through 3 companies
for ($i = 1; $i <= 3; $i++) {
    $companyId = $quote["empresa{$i}_id"];
    
    // Fetch Company Data
    $stmt = $pdo->prepare("SELECT * FROM empresas WHERE id = ?");
    $stmt->execute([$companyId]);
    $company = $stmt->fetch();

    if (!$company) {
        $results[] = "Empresa $i não encontrada.";
        continue;
    }

    // SMTP Config
    $host = $company['smtp_host'] ?? '';
    $user = $company['smtp_user'] ?? '';
    $pass = $company['smtp_pass'] ?? '';
    $port = $company['smtp_port'] ?? 587;
    $secure = $company['smtp_secure'] ?? 'tls';

    // Validate SMTP
    if (!$host || !$user || !$pass) {
        $results[] = "{$company['nome']}: SMTP não configurado.";
        continue;
    }

    // Prepare Email
    $mail = new PHPMailer(true);
    try {
        // Debug capture (optional, clean for production usually)
        $mail->SMTPDebug = SMTP::DEBUG_OFF;

        $mail->isSMTP();
        $mail->Host       = $host;
        $mail->SMTPAuth   = true;
        $mail->Username   = $user;
        $mail->Password   = $pass;
        
        if ($secure === 'tls') $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        elseif ($secure === 'ssl') $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        else {
            $mail->SMTPSecure = false;
            $mail->SMTPAutoTLS = false;
        }
        
        $mail->Port       = $port;
        $mail->CharSet    = 'UTF-8';
        $mail->Timeout    = 20; // Allow some time

        // Sender & Recipient
        $mail->setFrom($user, $company['nome']);
        $mail->addAddress($recipient);
        
        // Random Subject & Body
        $useSubject = $subjects[array_rand($subjects)];
        $useBodyRaw = $bodies[array_rand($bodies)];
        $useBody = str_replace('%COMPANY_NAME%', $company['nome'], $useBodyRaw);

        $mail->isHTML(true);
        $mail->Subject = $useSubject;
        $mail->Body    = $useBody;

        // Attachment (Use the specific PDF for this iteration)
        if (isset($_FILES['pdf' . $i]) && $_FILES['pdf' . $i]['error'] == 0) {
            $name = 'Orcamento_' . $i . '_' . preg_replace('/[^a-zA-Z0-9]/', '_', $quote['titulo']) . '.pdf';
            $mail->addAttachment($_FILES['pdf' . $i]['tmp_name'], $name);
        } else {
            $results[] = "{$company['nome']}: PDF não recebido.";
            continue; // Skip sending if no PDF? Or send anyway? Better skip.
        }

        $mail->send();
        $successCount++;
        $results[] = "{$company['nome']}: Enviado com sucesso.";

    } catch (Exception $e) {
        $results[] = "{$company['nome']}: Erro SMTP - " . $mail->ErrorInfo;
    }
}

// Final Response
if ($successCount > 0) {
    if ($successCount == 3) {
        echo json_encode(['success' => true, 'message' => 'Todos os 3 e-mails foram enviados com sucesso!']);
    } else {
        echo json_encode(['success' => true, 'message' => "Enviados $successCount/3 e-mails.", 'details' => $results]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Nenhum e-mail foi enviado.', 'details' => $results]);
}
