const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'views');
for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.ejs')) {
        let content = fs.readFileSync(path.join(dir, file), 'utf8');
        
        // replace number_format(X, 2, ',', '.')
        content = content.replace(/number_format\(([^,]+?),\s*2,\s*',',\s*'\.'\)/g, "Number($1).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })");
        
        // date('d/m/Y H:i', strtotime(X))
        content = content.replace(/date\('d\/m\/Y H:i',\s*strtotime\(([^)]+?)\)\)/g, "new Date($1).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })");
        
        // date('d/m/Y', strtotime(X))
        content = content.replace(/date\('d\/m\/Y',\s*strtotime\(([^)]+?)\)\)/g, "new Date($1).toLocaleDateString('pt-BR')");
        
        // date('d/m/Y H:i')
        content = content.replace(/date\('d\/m\/Y H:i'\)/g, "new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })");
        
        // date('Y')
        content = content.replace(/date\('Y'\)/g, "new Date().getFullYear()");
        
        // time()
        content = content.replace(/time\(\)/g, "Date.now()");
        
        // isset(X)
        content = content.replace(/isset\(([^)]+?)\)/g, "(typeof $1 !== 'undefined' && $1 !== null)");
        
        // empty(X)
        content = content.replace(/empty\(([^)]+?)\)/g, "(!$1 || $1.length === 0)");
        
        // sprintf('%06d', X)
        content = content.replace(/sprintf\('%06d',\s*([^)]+?)\)/g, "String($1).padStart(6, '0')");

        fs.writeFileSync(path.join(dir, file), content);
    }
}
console.log("PHP functions converted to JS!");
