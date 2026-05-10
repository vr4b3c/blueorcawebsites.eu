<?php
/**
 * BlueOrca Websites – Poptávkový formulář
 * Přijímá POST, validuje vstupy a odesílá e-mail na info@blueorcawebsites.eu
 */

// Pouze POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// ── Pomocné funkce ─────────────────────────────────────────────────────────────

function sanitize(string $val): string
{
    return htmlspecialchars(strip_tags(trim($val)), ENT_QUOTES, 'UTF-8');
}

function json_error(string $msg, int $code = 422): void
{
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

// ── Načtení a validace vstupů ──────────────────────────────────────────────────

$service = sanitize($_POST['service'] ?? '');
$name    = sanitize($_POST['name']    ?? '');
$email   = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
$message = sanitize($_POST['message'] ?? '');

// Honeypot: robotí pole musí zůstat prázdné
if (!empty($_POST['website'])) {
    // Tiché zahození bez chybové zprávy – neodhalujeme existenci ochrany
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

if (!$name)    json_error('Vyplňte prosím jméno.');
if (!$email)   json_error('Zadejte platnou e-mailovou adresu.');
if (!$message) json_error('Napište prosím zprávu.');

// ── Sestavení e-mailu ──────────────────────────────────────────────────────────

$serviceLabels = [
    'web'      => 'Vývoj webu',
    'redesign' => 'Redesign webu',
    'audit'    => 'Audit webu',
    'other'    => 'Ostatní',
];
$serviceLabel = $serviceLabels[$service] ?? ucfirst($service) ?: 'Neuvedeno';

$to      = 'info@webolution.cz';
$subject = '=?UTF-8?B?' . base64_encode('Nová poptávka – ' . $serviceLabel) . '?=';

$body  = "Nová poptávka z webu BlueOrca Websites\n";
$body .= str_repeat('─', 44) . "\n\n";
$body .= "Služba:  {$serviceLabel}\n";
$body .= "Jméno:   {$name}\n";
$body .= "E-mail:  {$email}\n\n";
$body .= "Zpráva:\n{$message}\n\n";
$body .= str_repeat('─', 44) . "\n";
$body .= "Odesláno z blueorcawebsites.eu\n";

$headers  = "From: BlueOrca Websites <info@blueorcawebsites.eu>\r\n";
$headers .= "Reply-To: {$name} <{$email}>\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "Content-Transfer-Encoding: 8bit\r\n";
$headers .= "X-Mailer: BlueOrca-ContactForm/1.0\r\n";

// ── Odeslání ───────────────────────────────────────────────────────────────────

$sent = mail($to, $subject, $body, $headers);

if ($sent) {
    http_response_code(200);
    echo json_encode(['ok' => true]);
} else {
    json_error('Odeslání selhalo. Zkuste to prosím znovu nebo nás kontaktujte přímo.', 500);
}
