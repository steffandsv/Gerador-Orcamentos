<h2>Orçamentos Gerados</h2>
<div style="margin-bottom: 15px;">
    <a href="index.php?page=orcamento_form" class="btn">Novo Orçamento</a>
</div>

<table>
    <thead>
        <tr>
            <th>ID</th>
            <th>Data</th>
            <th>Título</th>
            <th>Vencedora</th>
            <th>Variação Max</th>
            <th>Ações</th>
        </tr>
    </thead>
    <tbody>
        <?php if (empty($orcamentos)): ?>
        <tr>
            <td colspan="6" style="text-align:center;">Nenhum orçamento cadastrado.</td>
        </tr>
        <?php else: ?>
            <?php foreach ($orcamentos as $orc): ?>
            <tr>
                <td><?= $orc['id'] ?></td>
                <td><?= date('d/m/Y H:i', strtotime($orc['data_criacao'])) ?></td>
                <td><?= htmlspecialchars($orc['titulo']) ?></td>
                <td><?= htmlspecialchars($orc['empresa_vencedora'] ?? 'N/A') ?></td>
                <td><?= $orc['variacao_maxima'] ?>%</td>
                <td>
                    <div style="display:flex; gap:5px;">
                        <button onclick="generateQuotes(<?= $orc['id'] ?>)" class="btn btn-small" title="Gerar PDF">
                            <i class="fas fa-print"></i>
                        </button>
                        <a href="index.php?page=orcamento_form&id=<?= $orc['id'] ?>" class="btn btn-small btn-secondary" title="Editar">
                            <i class="fas fa-edit"></i>
                        </a>
                        <form action="index.php" method="POST" onsubmit="return confirm('Tem certeza que deseja excluir este orçamento?');" style="margin:0;">
                            <input type="hidden" name="action" value="delete_quote">
                            <input type="hidden" name="id" value="<?= $orc['id'] ?>">
                            <button type="submit" class="btn btn-small btn-danger" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </form>
                    </div>
                </td>
            </tr>
            <?php endforeach; ?>
        <?php endif; ?>
    </tbody>
</table>

<script>
function generateQuotes(id) {
    // Open 3 tabs
    window.open('index.php?page=print&id=' + id + '&company_index=1', '_blank');
    // Small delay to ensure browser doesn't block popups if possible, though modern browsers block multiple automatic popups. 
    // The user might need to allow popups.
    setTimeout(() => {
        window.open('index.php?page=print&id=' + id + '&company_index=2', '_blank');
    }, 200);
    setTimeout(() => {
        window.open('index.php?page=print&id=' + id + '&company_index=3', '_blank');
    }, 400);
}
</script>
