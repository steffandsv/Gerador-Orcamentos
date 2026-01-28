<?php
$files = glob(__DIR__ . '/../views/print_layout_*.php');

$obfuscated_code = "<?= join('', array_map(function(\$char) { return '&#' . ord(\$char) . ';'; }, str_split(\$company['email']))) ?>";

foreach ($files as $file) {
    if (!file_exists($file)) continue;

    $content = file_get_contents($file);
    $original = $content;

    // 1. Remove Obfuscated Code specifically
    // We look for the prefix too
    $content = str_replace('| Email: ' . $obfuscated_code, '', $content);
    $content = str_replace('Email: ' . $obfuscated_code, '', $content);
    $content = str_replace($obfuscated_code, '', $content); // catch-all

    // 2. Remove standard email patterns regex
    // " | Email: <?= htmlspecialchars($company['email']) ?>"
    $content = preg_replace('/\|\s*Email:\s*<\?= htmlspecialchars\(\$company\[\'email\'\]\) \?>/i', '', $content);

    // " &bull; <?= htmlspecialchars($company['email']) ?>"
    // " &bull; $company['email']"
    $content = preg_replace('/&bull;\s*(Email:)?\s*<\?= htmlspecialchars\(\$company\[\'email\'\]\) \?>/i', '', $content);
    
    // "Email: <?= ... ?>"
    $content = preg_replace('/Email:\s*<\?= htmlspecialchars\(\$company\[\'email\'\]\) \?>/i', '', $content);

    // Orphan generic
    $content = preg_replace('/<\?= htmlspecialchars\(\$company\[\'email\'\]\) \?>/i', '', $content);

    if ($content !== $original) {
        file_put_contents($file, $content);
        echo "Updated: " . basename($file) . "\n";
    } else {
        echo "No changes: " . basename($file) . "\n";
    }
}
