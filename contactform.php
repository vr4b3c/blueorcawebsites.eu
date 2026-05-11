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

const BOT_MIN_FILL_SECONDS = 3;
const RATE_LIMIT_WINDOW_SECONDS = 600;
const RATE_LIMIT_MAX_ATTEMPTS = 6;

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

function get_client_ip(): string
{
    $cloudflareIp = trim((string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ''));
    if ($cloudflareIp && filter_var($cloudflareIp, FILTER_VALIDATE_IP)) {
        return $cloudflareIp;
    }

    $remoteAddr = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    if ($remoteAddr && filter_var($remoteAddr, FILTER_VALIDATE_IP)) {
        return $remoteAddr;
    }

    return 'unknown';
}

function validate_started_at(string $startedAt): void
{
    if (!preg_match('/^\d{10}$/', $startedAt)) {
        json_error('Formulář není připravený k odeslání. Obnovte stránku a zkuste to znovu.', 400);
    }

    $age = time() - (int) $startedAt;
    if ($age < BOT_MIN_FILL_SECONDS) {
        json_error('Odeslání proběhlo příliš rychle. Zkuste to prosím znovu.', 422);
    }
}

function enforce_rate_limit(string $clientKey, int $maxAttempts, int $windowSeconds): void
{
    $directory = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'blueorca-contactform';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        return;
    }

    $filePath = $directory . DIRECTORY_SEPARATOR . hash('sha256', $clientKey) . '.json';
    $handle = fopen($filePath, 'c+');
    if ($handle === false) {
        return;
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        return;
    }

    $now = time();
    $cutoff = $now - $windowSeconds;
    $stored = stream_get_contents($handle);
    $decoded = json_decode($stored ?: '[]', true);
    $attempts = [];

    if (is_array($decoded)) {
        foreach ($decoded as $timestamp) {
            if (is_numeric($timestamp)) {
                $timestamp = (int) $timestamp;
                if ($timestamp >= $cutoff) {
                    $attempts[] = $timestamp;
                }
            }
        }
    }

    if (count($attempts) >= $maxAttempts) {
        $retryAfter = max(1, (min($attempts) + $windowSeconds) - $now);
        flock($handle, LOCK_UN);
        fclose($handle);
        header('Retry-After: ' . $retryAfter);
        json_error('Zkoušíte to příliš často. Zkuste to prosím znovu za pár minut.', 429);
    }

    $attempts[] = $now;
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($attempts));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
}

// ── Načtení a validace vstupů ──────────────────────────────────────────────────

$service = sanitize($_POST['service'] ?? '');
$name    = sanitize($_POST['name']    ?? '');
$contact = sanitize($_POST['email']   ?? '');
$message = sanitize($_POST['message'] ?? '');
$startedAt = trim((string) ($_POST['started_at'] ?? ''));

// Honeypot: robotí pole musí zůstat prázdné
if (!empty($_POST['website'])) {
    // Tiché zahození bez chybové zprávy – neodhalujeme existenci ochrany
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

validate_started_at($startedAt);

// Kontakt = e-mail nebo telefon (min. 6 znaků)
$isEmail = (bool) filter_var($contact, FILTER_VALIDATE_EMAIL);
if (!$name)                      json_error('Vyplňte prosím jméno.');
if (strlen($contact) < 6)        json_error('Zadejte platný e-mail nebo telefonní číslo.');
if (!$message)                   json_error('Napište prosím zprávu.');

enforce_rate_limit(get_client_ip(), RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_SECONDS);

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
$body .= "Kontakt: {$contact}\n\n";
$body .= "Zpráva:\n{$message}\n\n";
$body .= str_repeat('─', 44) . "\n";
$body .= "Odesláno z blueorcawebsites.eu\n";

$headers  = "From: BlueOrca Websites <info@blueorcawebsites.eu>\r\n";
if ($isEmail) {
    $headers .= "Reply-To: {$name} <{$contact}>\r\n";
}
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
