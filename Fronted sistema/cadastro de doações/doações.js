// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z3R3ZGNkanRic2xjYXZlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQxNTgsImV4cCI6MjA5MDY1MDE1OH0.TlvsoZkzLjKimaqvqMrekWLlWL7dvOfLtimJOTr8htU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- SELETORES ---
const areaListagem  = document.getElementById('area-listagem');
const areaCadastro  = document.getElementById('area-cadastro');
const bookTableBody = document.getElementById('bookTableBody');
const noDataMessage = document.getElementById('noDataMessage');
const formDoacao    = document.getElementById('formDoacao');
const selectGenero  = document.getElementById('genero');
const inputQtd      = document.getElementById('quantidade');
const inputIsbn     = document.getElementById('isbn');

let isbnParaExcluir = null;
let filtroAtual     = null; // null = todos os gêneros

// --- TOAST ---
function showToast(msg, tipo = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span class="toast-icon">${tipo === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// --- NAVEGAÇÃO ---
document.getElementById('openModal').onclick = () => {
    areaListagem.style.display = 'none';
    areaCadastro.style.display = 'block';
};

function fecharCadastro() {
    areaCadastro.style.display = 'none';
    areaListagem.style.display = 'block';
    formDoacao.reset();
    document.getElementById('containerEtiquetas').innerHTML = '';
    document.getElementById('labelEtiquetas').style.display = 'none';
    document.getElementById('helperEtiquetas').style.display = 'none';
}

// --- GÊNEROS ---
// Carrega da mesma tabela "generos" usada no cadastro de livros.
// Isso garante que os gêneros sejam sempre os mesmos nos dois módulos.
async function carregarGenerosNoSelect() {
    const { data, error } = await supabaseClient.from('generos').select('*').order('nome');
    if (error || !data) return;

    selectGenero.innerHTML = '<option value="">Selecione um gênero</option>';
    data.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.nome;
        opt.textContent = g.nome;
        selectGenero.appendChild(opt);
    });
}

async function atualizarBarraDeGeneros() {
    const { data: generos } = await supabaseClient.from('generos').select('*').order('nome');
    const { data: doacoes } = await supabaseClient.from('doacoes').select('genero');

    const container = document.getElementById('genresTabs');
    container.innerHTML = '';

    // Botão "Todos"
    const btnTodos = document.createElement('button');
    btnTodos.className = `tab-item ${filtroAtual === null ? 'active' : ''}`;
    btnTodos.textContent = `Todos (${doacoes?.length || 0})`;
    btnTodos.onclick = () => {
        filtroAtual = null;
        document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
        btnTodos.classList.add('active');
        listarDoacoes();
    };
    container.appendChild(btnTodos);

    // Botão por gênero
    generos?.forEach(g => {
        const qtd = doacoes?.filter(d => d.genero === g.nome).length || 0;
        const btn = document.createElement('button');
        btn.className = `tab-item ${filtroAtual === g.nome ? 'active' : ''}`;
        btn.textContent = `${g.nome} (${qtd})`;
        btn.onclick = () => {
            filtroAtual = g.nome;
            document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            listarDoacoes(g.nome);
        };
        container.appendChild(btn);
    });
}

// --- LISTAGEM DE DOAÇÕES ---
async function listarDoacoes(filtroGenero = null) {
    let query = supabaseClient.from('doacoes').select('*').order('created_at', { ascending: false });
    if (filtroGenero) query = query.eq('genero', filtroGenero);

    const { data: doacoes, error } = await query;
    if (error) { console.error(error); return; }

    bookTableBody.innerHTML = '';

    if (!doacoes || doacoes.length === 0) {
        noDataMessage.style.display = 'block';
        return;
    }

    noDataMessage.style.display = 'none';

    // Busca todos os exemplares dos ISBNs de uma vez (evita N+1 queries)
    const isbns = [...new Set(doacoes.map(d => d.isbn))];
    const { data: exemplares } = await supabaseClient
        .from('exemplares')
        .select('isbn_vinculado, status, codigo_rfid')
        .in('isbn_vinculado', isbns);

    doacoes.forEach(doacao => {
        const exDoacao    = exemplares?.filter(e => e.isbn_vinculado === doacao.isbn) || [];
        const total       = exDoacao.length;
        const disponiveis = exDoacao.filter(e => e.status === 'Disponível').length;
        const dataFormatada = new Date(doacao.created_at).toLocaleDateString('pt-BR');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${doacao.nome_doador}</td>
            <td>${doacao.titulo}</td>
            <td>${doacao.autor}</td>
            <td><span class="badge-genero">${doacao.genero || 'N/A'}</span></td>
            <td>${doacao.ano || '—'}</td>
            <td><span class="status-count">${disponiveis}/${total}</span></td>
            <td>
                <button class="btn-tags" onclick='abrirModalEtiquetas(${JSON.stringify({ titulo: doacao.titulo, exemplares: exDoacao })})'>
                    <i class="bi bi-tag"></i> ${total}
                </button>
            </td>
            <td>
                <button class="btn-delete" onclick="confirmarExclusao('${doacao.isbn}', '${doacao.titulo.replace(/'/g, "\\'")}')" title="Excluir">
                    <i class="bi bi-trash3"></i>
                </button>
            </td>
        `;
        bookTableBody.appendChild(tr);
    });
}

// --- BUSCA ---
document.getElementById('searchInput').addEventListener('input', function () {
    const termo = this.value.toLowerCase();
    document.querySelectorAll('#bookTableBody tr').forEach(tr => {
        const texto = tr.textContent.toLowerCase();
        tr.style.display = texto.includes(termo) ? '' : 'none';
    });
});

// --- SUBMIT DO FORMULÁRIO ---
formDoacao.onsubmit = async (e) => {
    e.preventDefault();

    const isbnLimpo = inputIsbn.value.replace(/\D/g, '');
    const etiquetas = Array.from(document.querySelectorAll('.input-etiqueta'))
        .map(i => i.value.trim())
        .filter(v => v);

    const dadosDoacao = {
        nome_doador: document.getElementById('nome_doador').value.trim(),
        isbn:        isbnLimpo,
        titulo:      document.getElementById('titulo').value.trim(),
        autor:       document.getElementById('autor').value.trim(),
        edicao:      document.getElementById('edicao').value.trim(),
        ano:         parseInt(document.getElementById('ano').value),
        genero:      selectGenero.value,
        quantidade:  parseInt(inputQtd.value)
    };

    try {
        // 1. Salva na tabela de doações (para histórico de quem doou)
        const { error: errD } = await supabaseClient.from('doacoes').insert([dadosDoacao]);
        if (errD) throw errD;

        // 2. Adiciona o livro no acervo principal (tabela livros)
        //    Usa upsert para não duplicar se o ISBN já existir
        const { error: errL } = await supabaseClient.from('livros').upsert([{
            isbn:   isbnLimpo,
            titulo: dadosDoacao.titulo,
            autor:  dadosDoacao.autor,
            edicao: dadosDoacao.edicao,
            ano:    dadosDoacao.ano,
            genero: dadosDoacao.genero
        }], { onConflict: 'isbn' });
        if (errL) throw errL;

        // 3. Adiciona os exemplares físicos (para empréstimo via RFID)
        if (etiquetas.length > 0) {
            const exemplares = etiquetas.map(rfid => ({
                isbn_vinculado: isbnLimpo,
                status:         'Disponível',
                codigo_rfid:    rfid
            }));
            const { error: errE } = await supabaseClient.from('exemplares').insert(exemplares);
            if (errE) throw errE;
        }

        showToast('Doação registrada com sucesso! 💖');
        fecharCadastro();
        listarDoacoes(filtroAtual);
        atualizarBarraDeGeneros();

    } catch (err) {
        showToast('Erro ao registrar: ' + err.message, 'error');
    }
};

// --- MODAL DE ETIQUETAS ---
function abrirModalEtiquetas(livro) {
    document.getElementById('modalEtiquetasTitulo').textContent = livro.titulo;
    document.getElementById('modalTotalEtiquetas').textContent  = `Total: ${livro.exemplares.length}`;

    const grid = document.getElementById('modalEtiquetasGrid');
    grid.innerHTML = livro.exemplares.map((ex, i) => `
        <div class="tag-card">
            <div class="tag-header">
                <i class="bi bi-tag" style="color:#3b82f6;"></i>
                <span class="tag-code">${ex.codigo_rfid || 'SEM RFID'}</span>
            </div>
            <div class="tag-body">
                <p>Exemplar #${i + 1}</p>
                <span class="badge-disponivel">${ex.status || 'Disponível'}</span>
            </div>
        </div>
    `).join('');

    document.getElementById('modalEtiquetas').style.display = 'flex';
}

// --- EXCLUSÃO ---
function confirmarExclusao(isbn, titulo) {
    isbnParaExcluir = isbn;
    document.getElementById('nomeLivroExcluir').textContent = titulo;
    document.getElementById('deleteModal').style.display    = 'flex';
}

function fecharModalDelete() {
    document.getElementById('deleteModal').style.display = 'none';
    isbnParaExcluir = null;
}

document.getElementById('confirmDeleteBtn').onclick = async () => {
    if (!isbnParaExcluir) return;

    try {
        // Remove da tabela doacoes
        await supabaseClient.from('doacoes').delete().eq('isbn', isbnParaExcluir);

        // Remove exemplares do acervo
        await supabaseClient.from('exemplares').delete().eq('isbn_vinculado', isbnParaExcluir);

        // Remove o livro do acervo principal
        await supabaseClient.from('livros').delete().eq('isbn', isbnParaExcluir);

        showToast('Doação excluída com sucesso!');
        fecharModalDelete();
        listarDoacoes(filtroAtual);
        atualizarBarraDeGeneros();

    } catch (err) {
        showToast('Erro ao excluir: ' + err.message, 'error');
        fecharModalDelete();
    }
};

// --- ETIQUETAS DINÂMICAS (igual ao cadastro de livros) ---
inputQtd.addEventListener('input', function () {
    const qtd = parseInt(this.value);
    const container    = document.getElementById('containerEtiquetas');
    const labelEt      = document.getElementById('labelEtiquetas');
    const helperEt     = document.getElementById('helperEtiquetas');

    container.innerHTML = '';

    if (qtd > 0 && qtd <= 50) {
        labelEt.style.display  = 'block';
        helperEt.style.display = 'block';
        for (let i = 1; i <= qtd; i++) {
            const grupo = document.createElement('div');
            grupo.className = 'form-group';
            grupo.style.width = 'calc(25% - 15px)';
            grupo.innerHTML = `
                <h5>RFID ${i}</h5>
                <input type="text" class="input-etiqueta" placeholder="Exemplar ${i}"
                       maxlength="10" oninput="this.value = this.value.replace(/\\D/g, '')" required>
            `;
            container.appendChild(grupo);
        }
    } else {
        labelEt.style.display  = 'none';
        helperEt.style.display = 'none';
    }
});

// --- MÁSCARA ISBN (igual ao cadastro de livros) ---
inputIsbn.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 13);
    let f = '';
    if (v.length > 0)  f += v.substring(0, 3);
    if (v.length > 3)  f += '-' + v.substring(3, 5);
    if (v.length > 5)  f += '-' + v.substring(5, 8);
    if (v.length > 8)  f += '-' + v.substring(8, 12);
    if (v.length > 12) f += '-' + v.substring(12, 13);
    e.target.value = f;
});

// --- SIDEBAR ---
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('collapsed');
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// --- INICIALIZAÇÃO ---
carregarGenerosNoSelect();
listarDoacoes();
atualizarBarraDeGeneros();

/* ================================================================
   USUÁRIO LOGADO — sidebar e modal de saída
   ================================================================ */
function carregarUsuario() {
    document.querySelectorAll('nav a').forEach(link => {
        const texto = link.querySelector('.nav-text');
        if (texto) link.setAttribute('data-tip', texto.textContent.trim());
    });
    const admin = JSON.parse(sessionStorage.getItem('admin') || 'null');
    if (!admin) return;
    const primeiroNome = admin.nome ? admin.nome.split(' ')[0] : '—';
    const elNome   = document.getElementById('sidebarNome');
    const elCargo  = document.getElementById('sidebarCargo');
    const elMNome  = document.getElementById('modalNome');
    const elMCargo = document.getElementById('modalCargo');
    if (elNome)   elNome.textContent   = primeiroNome;
    if (elCargo)  elCargo.textContent  = admin.cargo  || '';
    if (elMNome)  elMNome.textContent  = admin.nome   || '—';
    if (elMCargo) elMCargo.textContent = admin.cargo  || '—';
}
function abrirModalSair() {
    document.getElementById('modalSair').classList.add('ativo');
    document.body.style.overflow = 'hidden';
}
function fecharModalSair(event) {
    if (event && event.target !== document.getElementById('modalSair')) return;
    document.getElementById('modalSair').classList.remove('ativo');
    document.body.style.overflow = '';
}
function confirmarSaida() {
    sessionStorage.removeItem('admin');
    window.location.href = '/Fronted sistema/login/login.html';
}
document.addEventListener('DOMContentLoaded', carregarUsuario);
