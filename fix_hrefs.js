const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'views');
for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.ejs')) {
        let content = fs.readFileSync(path.join(dir, file), 'utf8');
        
        // replace href="index.php?page=empresas" -> href="/empresas"
        content = content.replace(/index\.php\?page=empresas/g, "/empresas");
        content = content.replace(/index\.php\?page=orcamentos/g, "/orcamentos");
        content = content.replace(/index\.php\?page=empresa_form/g, "/empresas/form");
        content = content.replace(/index\.php\?page=orcamento_form/g, "/orcamentos/form");
        content = content.replace(/href="index\.php"/g, 'href="/"');

        // replace form action
        content = content.replace(/action="index\.php\?action=(save_quote|save_company|delete_quote|delete_company)"/g, (match, p1) => {
            if (p1 === 'save_quote') return 'action="/orcamentos/save"';
            if (p1 === 'delete_quote') return 'action="/orcamentos/delete"';
            if (p1 === 'save_company') return 'action="/empresas/save"';
            if (p1 === 'delete_company') return 'action="/empresas/delete"';
            return match;
        });

        // Also fix any form action that just pointed to index.php with a hidden action input
        // e.g., <form action="index.php" method="POST"> <input type="hidden" name="action" value="save_quote">
        content = content.replace(/action="index\.php"/g, 'action=""'); // Let JS or specific handlers catch it if needed, or we'll assume the above caught the explicit ones.

        fs.writeFileSync(path.join(dir, file), content);
    }
}
console.log("PHP HREFs converted!");
