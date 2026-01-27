
// --- Autocomplete Logic ---
document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('solicitante_nome');
    const listContainer = document.getElementById('solicitante_list_container');
    const cnpjInput = document.getElementById('solicitante_cnpj');
    let debounceTimer;

    if (!input || !listContainer) return;

    input.addEventListener('input', function() {
        const term = this.value;
        
        clearTimeout(debounceTimer);
        
        if (term.length < 3) {
            listContainer.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => {
            fetch('index.php?action=search_solicitante&term=' + encodeURIComponent(term))
                .then(response => response.json())
                .then(data => {
                    listContainer.innerHTML = '';
                    if (data.length > 0) {
                        data.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'autocomplete-item';
                            // Highlight match
                            const regex = new RegExp(`(${term})`, 'gi');
                            const highlighted = item.solicitante_nome.replace(regex, '<strong>$1</strong>');
                            
                            div.innerHTML = `${highlighted} <span style="font-size:0.8em; color:#888;">(${item.solicitante_cnpj || 'Sem CNPJ'})</span>`;
                            
                            div.addEventListener('click', function() {
                                input.value = item.solicitante_nome;
                                if (cnpjInput) {
                                    cnpjInput.value = item.solicitante_cnpj;
                                    cnpjInput.style.backgroundColor = '#e6fffa';
                                    setTimeout(() => cnpjInput.style.backgroundColor = '', 1000);
                                }
                                listContainer.style.display = 'none';
                            });
                            
                            listContainer.appendChild(div);
                        });
                        listContainer.style.display = 'block';
                    } else {
                        listContainer.style.display = 'none';
                    }
                })
                .catch(err => console.error('Autocomplete error:', err));
        }, 300); // Debounce 300ms
    });

    // Close on click outside
    document.addEventListener('click', function(e) {
        if (e.target !== input && e.target !== listContainer) {
            listContainer.style.display = 'none';
        }
    });
});
