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
const MAX_NAME_LENGTH = 120;
const MAX_CONTACT_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 4000;

// ── Pomocné funkce ─────────────────────────────────────────────────────────────

function sanitize(string $val): string
{
    $val = trim($val);
    $val = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $val) ?? '';
    return htmlspecialchars(strip_tags($val), ENT_QUOTES, 'UTF-8');
}

function is_cloudflare_proxy(string $ip): bool
{
    $ranges = [
        '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
        '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
        '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
        '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    ];

    $ipLong = ip2long($ip);
    if ($ipLong === false) {
        return false;
    }

    foreach ($ranges as $range) {
        [$subnet, $bits] = explode('/', $range);
        $subnetLong = ip2long($subnet);
        if ($subnetLong === false) {
            continue;
        }
        $mask = -1 << (32 - (int) $bits);
        if (($ipLong & $mask) === ($subnetLong & $mask)) {
            return true;
        }
    }

    return false;
}

function json_error(string $msg, int $code = 422): void
{
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

function get_client_ip(): string
{
    $remoteAddr = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    $cloudflareIp = trim((string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ''));

    if ($remoteAddr && filter_var($remoteAddr, FILTER_VALIDATE_IP) && $cloudflareIp && filter_var($cloudflareIp, FILTER_VALIDATE_IP) && is_cloudflare_proxy($remoteAddr)) {
        return $cloudflareIp;
    }

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
if (!$name) json_error('Vyplňte prosím jméno.');
if (strlen($name) > MAX_NAME_LENGTH) json_error('Jméno je příliš dlouhé.');
if (strlen($contact) > MAX_CONTACT_LENGTH) json_error('Kontakt je příliš dlouhý.');
if (!$isEmail && !preg_match('/^\+?[0-9 ()-]{6,32}$/', $contact)) json_error('Zadejte platný e-mail nebo telefonní číslo.');
if (!$message) json_error('Napište prosím zprávu.');
if (strlen($message) > MAX_MESSAGE_LENGTH) json_error('Zpráva je příliš dlouhá.');

enforce_rate_limit(get_client_ip(), RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_SECONDS);

// ── Sestavení e-mailu ──────────────────────────────────────────────────────────

$serviceLabels = [
    'web'      => 'Vývoj webu',
    'redesign' => 'Redesign webu',
    'audit'    => 'Audit webu',
    'other'    => 'Ostatní',
];
$serviceLabel = $serviceLabels[$service] ?? 'Neuvedeno';

$to      = 'info@blueorcawebsites.eu';
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
    // Strip line terminators from name to prevent email header injection
    $headerSafeName = preg_replace('/[\r\n\t]/', ' ', $name);
    $headers .= "Reply-To: {$headerSafeName} <{$contact}>\r\n";
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
