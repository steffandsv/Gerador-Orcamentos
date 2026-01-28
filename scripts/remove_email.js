const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '../views');
const files = fs.readdirSync(viewsDir).filter(f => f.startsWith('print_layout_') && f.endsWith('.php'));

files.forEach(file => {
    const filePath = path.join(viewsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Regex patterns
    // 1. Obfuscated email (Layout 1 specific)
    // Matches the join/ord/split mess
    content = content.replace(/\|\s*Email:\s*<\?= join\('', array_map\(function\(\$char\) \{ return '&#' \. ord\(\$char\) \. ';'; \}, str_split\(\$company\['email'\]\)\)\) \?>/g, '');

    // 2. Standard email with specific labels and piping
    // | Email: <?= htmlspecialchars($company['email']) ?>
    content = content.replace(/\|\s*Email:\s*<\?= htmlspecialchars\(\$company\['email'\]\) \?>/gi, '');

    // 3. Bullet email
    // &bull; <?= htmlspecialchars($company['email']) ?>
    content = content.replace(/&bull;\s*(Email:)?\s*<\?= htmlspecialchars\(\$company\['email'\]\) \?>/gi, '');

    // 4. Raw email output if leftover
    // <?= htmlspecialchars($company['email']) ?>
    content = content.replace(/<\?= htmlspecialchars\(\$company\['email'\]\) \?>/gi, '');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${file}`);
    } else {
        console.log(`No changes (or pattern not found): ${file}`);
    }
});
