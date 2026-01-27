<h2>Empresas Cadastradas</h2>
<div style="margin-bottom: 15px;">
    <a href="index.php?page=empresa_form" class="btn">Nova Empresa</a>
</div>

<table>
    <thead>
        <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>Documento</th>
            <th>Email</th>
            <th>Ações</th>
        </tr>
    </thead>
    <tbody>
        <?php if (empty($empresas)): ?>
        <tr>
            <td colspan="5" style="text-align:center;">Nenhuma empresa cadastrada.</td>
        </tr>
        <?php else: ?>
            <?php foreach ($empresas as $emp): ?>
            <tr>
                <td><?= $emp['id'] ?></td>
                <td><?= htmlspecialchars($emp['nome']) ?></td>
                <td><?= htmlspecialchars($emp['documento']) ?></td>
                <td><?= htmlspecialchars($emp['email']) ?></td>
                <td>
                    <a href="index.php?page=empresa_form&id=<?= $emp['id'] ?>" class="btn btn-small">Editar</a>
                    <form action="index.php" method="POST" style="display:inline;" onsubmit="return confirm('Tem certeza?');">
                        <input type="hidden" name="action" value="delete_company">
                        <input type="hidden" name="id" value="<?= $emp['id'] ?>">
                        <button type="submit" class="btn btn-small btn-danger">Excluir</button>
                    </form>
                </td>
            </tr>
            <?php endforeach; ?>
        <?php endif; ?>
    </tbody>
</table>
