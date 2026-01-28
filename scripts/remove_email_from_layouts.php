<?php
$files = glob(__DIR__ . '/../views/print_layout_*.php');

foreach ($files as $file) {
    if (!file_exists($file)) continue;

    $content = file_get_contents($file);
    $original = $content;

    // Pattern 1: Obfuscated Email (Layout 1)
    // Matches "| Email: <?= join... ?>" and surrounding potential tags or separators
    $content = preg_replace('/\|\s*Email:\s*<\?= join\(\'\'\, array_map\(function\(\$char\) \{ return \'&\#\' \. ord\(\$char\) \. \';\'; \}\, str_split\(\$company\[\'email\'\]\)\)\) \?>/', '', $content);
    
    // Pattern 2: Standard Email with separators
    // Matches " | Email: <?= htmlspecialchars($company['email']) ?>"
    $content = preg_replace('/\|\s*Email:\s*<\?= htmlspecialchars\(\$company\[\'email\'\]\) \?>/i', '', $content);

    // Pattern 3: Standard Email with bullets
    // Matches " &bull; <?= htmlspecialchars($company['email']) ?>"
    // Also optional "Email:" label
    $content = preg_replace('/&bull;\s*(Email:)?\s*<\?= htmlspecialchars\(\$company\[\'email\'\]\) \?>/i', '', $content);

    // Pattern 4: Just "Email: <...>" on its own line or with <br>
    $content = preg_replace('/Email:\s*<\?= htmlspecialchars\(\$company\[\'email\'\]\) \?>/i', '', $content);

    // Pattern 5: Catch-all for remaining $company['email'] echoes if any (orphan)
    $content = preg_replace('/<\?= htmlspecialchars\(\$company\[\'email\'\]\) \?>/i', '', $content);

    // Cleanup potential double separators or trailing chars if regex missed context
    // (Manual check might be needed if complex, but this covers observed patterns)

    if ($content !== $original) {
        file_put_contents($file, $content);
        echo "Updated: " . basename($file) . "\n";
    } else {
        echo "No changes: " . basename($file) . "\n";
    }
}
