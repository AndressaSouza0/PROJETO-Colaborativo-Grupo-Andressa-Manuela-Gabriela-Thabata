// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z3R3ZGNkanRic2xjYXZlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQxNTgsImV4cCI6MjA5MDY1MDE1OH0.TlvsoZkzLjKimaqvqMrekWLlWL7dvOfLtimJOTr8htU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- SELETORES ---
const areaListagem = document.getElementById("area-listagem");
const areaCadastro = document.getElementById("area-cadastro");
const btnAbrirCadastro = document.getElementById("openModal");
const btnCancelar = document.getElementById("btnCancelar");
const formLivro = document.getElementById("formCadastroLivroCorpo");
const selectGenero = document.getElementById('genero');
const bookTableBody = document.getElementById("bookTableBody");
const noDataMessage = document.getElementById("noDataMessage");
const modalGenero = document.getElementById("modalGenero");
const btnAbrirModalGenero = document.getElementById("openModalGenero");
const inputNomeGenero = document.getElementById("nome-genero-input");
const genresTabsContainer = document.getElementById("genresTabs");
const inputQuantidade = document.getElementById('quantidade');
const containerEtiquetas = document.getElementById('containerEtiquetas');
const labelEtiquetas = document.getElementById('labelEtiquetas');
const helperEtiquetas = document.getElementById('helperEtiquetas');
const inputIsbn = document.getElementById('isbn');

// Variável Global para Exclusão
let generoIdParaExcluir = null;

// --- FUNÇÃO DE NOTIFICAÇÃO (TOAST) ---
function showToast(mensagem, tipo = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    const icon = tipo === 'success' ? '✅' : '❌';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${mensagem}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- NAVEGAÇÃO ---
btnAbrirCadastro.onclick = () => {
    areaListagem.style.display = "none";
    areaCadastro.style.display = "block";
};

btnCancelar.onclick = () => {
    areaCadastro.style.display = "none";
    areaListagem.style.display = "block";
};

// --- CONTROLE DOS MODAIS ---

// Modal de Lista de Gêneros
btnAbrirModalGenero.onclick = () => {
    modalGenero.classList.add('ativo');
    document.body.style.overflow = 'hidden';
    renderizarListaGenerosModal();
};

const fecharModalG = () => {
    modalGenero.classList.remove('ativo');
    document.body.style.overflow = '';
};
document.getElementById("closeModalGenero").onclick = fecharModalG;
modalGenero.addEventListener('click', (e) => { if (e.target === modalGenero) fecharModalG(); });

async function openDeleteModal(id) {
    generoIdParaExcluir = id;
    try {
        const { data } = await supabaseClient.from('generos').select('nome').eq('id', id).single();
        if (data) document.getElementById('nomeGeneroExcluir').textContent = data.nome;
    } catch(e) {}
    document.getElementById('deleteModal').classList.add('ativo');
    document.body.style.overflow = 'hidden';
}
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('ativo');
    document.body.style.overflow = '';
    generoIdParaExcluir = null;
}
function fecharDeleteGenero(event) {
    if (event && event.target !== document.getElementById('deleteModal')) return;
    closeDeleteModal();
}

// Evento do botão "Excluir" dentro do Modal Bonito
document.getElementById('confirmDeleteBtn').onclick = async function() {
    if (!generoIdParaExcluir) return;

    try {
        // Verifica se existem livros vinculados
        const { data: generoParaDeletar } = await supabaseClient.from('generos').select('nome').eq('id', generoIdParaExcluir).single();

        if (generoParaDeletar) {
            const { data: livrosRelacionados } = await supabaseClient.from('livros').select('isbn').eq('genero', generoParaDeletar.nome);
            if (livrosRelacionados && livrosRelacionados.length > 0) {
                closeDeleteModal();
                return showToast(`Não é possível excluir. Existem ${livrosRelacionados.length} livro(s) neste gênero.`, "error");
            }
        }

        // Deleta do Supabase
        const { error } = await supabaseClient.from('generos').delete().eq('id', generoIdParaExcluir);
        if (error) throw error;

        showToast("Gênero excluído com sucesso!");
        closeDeleteModal();
        renderizarListaGenerosModal();
        carregarGenerosNoSelect();
        atualizarBarraDeGeneros();

    } catch (error) {
        showToast("Erro: " + error.message, "error");
        closeDeleteModal();
    }
};

// Fechar modais ao clicar fora
window.onclick = (event) => {
    if (event.target == modalGenero) fecharModalG();
    if (event.target == document.getElementById('deleteModal')) closeDeleteModal();
    if (event.target == document.getElementById('deleteBookModal')) closeDeleteBookModal(); // Adicionado
    if (event.target == document.getElementById('modalEtiquetas')) document.getElementById('modalEtiquetas').style.display = "none";
};

// --- LÓGICA DE GÊNEROS ---

async function atualizarBarraDeGeneros() {
    try {
        const { data: generos, error: errG } = await supabaseClient.from('generos').select('*');
        const { data: livros, error: errL } = await supabaseClient.from('livros').select('genero');
        if (errG || errL) throw new Error("Erro ao buscar dados");

        genresTabsContainer.innerHTML = '';
        const btnTodos = document.createElement('button');
        btnTodos.className = "tab-item active";
        btnTodos.innerHTML = `Todos (${livros.length})`;
        btnTodos.onclick = () => {
            document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
            btnTodos.classList.add('active');
            listarLivros();
        };
        genresTabsContainer.appendChild(btnTodos);

        generos.forEach(g => {
            const qtd = livros.filter(l => l.genero === g.nome).length;
            const btn = document.createElement('button');
            btn.className = "tab-item";
            btn.innerHTML = `${g.nome} (${qtd})`;
            btn.onclick = () => {
                document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                listarLivros(g.nome);
            };
            genresTabsContainer.appendChild(btn);
        });
    } catch (e) { console.error(e); }
}

async function carregarGenerosNoSelect() {
    const { data, error } = await supabaseClient.from('generos').select('*');
    if (error) return;
    selectGenero.innerHTML = '<option value="">Selecione um gênero</option>';
    data.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.nome;
        opt.textContent = g.nome;
        selectGenero.appendChild(opt);
    });
}

async function cadastrarNovoGenero() {
    const nome = inputNomeGenero.value.trim();
    if (!nome) return showToast("Digite um nome para o gênero!", "error");
    const { error } = await supabaseClient.from('generos').insert([{ nome }]);
    if (error) {
        showToast("Erro ao cadastrar: " + error.message, "error");
    } else {
        showToast("Gênero adicionado com sucesso!");
        inputNomeGenero.value = "";
        renderizarListaGenerosModal();
        carregarGenerosNoSelect();
        atualizarBarraDeGeneros();
    }
}

const btnSalvarGen = document.getElementById("btnSalvarGenero"); 
if(btnSalvarGen) btnSalvarGen.onclick = cadastrarNovoGenero;

async function renderizarListaGenerosModal() {
    const listaContainer = document.getElementById("listaGenerosContainer");
    const msgSemDados = document.getElementById("noDataMessageModal");
    if (!listaContainer) return;

    const { data: generos } = await supabaseClient.from('generos').select('*').order('nome');
    const { data: livros } = await supabaseClient.from('livros').select('genero');

    listaContainer.innerHTML = "";
    if (!generos || generos.length === 0) {
        if(msgSemDados) msgSemDados.style.display = "block";
        return;
    }
    if(msgSemDados) msgSemDados.style.display = "none";

    generos.forEach(g => {
        const qtdLivros = livros ? livros.filter(l => l.genero === g.nome).length : 0;
        const item = document.createElement('div');
        item.className = "genero-item-lista";
        item.innerHTML = `
            <div class="genero-info">
                <i class="bi bi-folder2-open"></i>
                <span class="genero-name">${g.nome}</span>
                <span class="genero-count">(${qtdLivros} livros)</span>
            </div>
            <button class="btn-del-genero" onclick="openDeleteModal(${g.id})">
                <i class="bi bi-trash3"></i>
            </button>
        `;
        listaContainer.appendChild(item);
    });
}

// --- LÓGICA DE LIVROS ---

function formatarISBN(valor) {
    if (!valor) return "N/A";
    const v = valor.replace(/\D/g, '');
    if (v.length === 13) {
        return `${v.substring(0, 3)}-${v.substring(3, 5)}-${v.substring(5, 8)}-${v.substring(8, 12)}-${v.substring(12, 13)}`;
    }
    return valor;
}

async function listarLivros(filtro = null) {
    try {
        // Simplificado para trazer os dados do livro e seus respectivos exemplares
        let query = supabaseClient.from('livros').select('*, exemplares(status, codigo_rfid)');
        
        if (filtro) query = query.eq('genero', filtro);
        
        const { data, error } = await query;
        if (error) throw error;

        bookTableBody.innerHTML = "";
        noDataMessage.style.display = (!data || data.length === 0) ? "block" : "none";

        if (!data) return;

        data.forEach(livro => {
            const total = livro.exemplares?.length || 0;
            const disponiveis = livro.exemplares?.filter(e => e.status === 'Disponível').length || 0;
            
            const tr = document.createElement('tr');
            tr.style.textAlign = "center"; 
            
            // HTML corrigido e com os dois botões organizados em suas respectivas colunas <td>
            tr.innerHTML = `
                <td>${formatarISBN(livro.isbn)}</td>
                <td>${livro.titulo || 'Sem Título'}</td>
                <td>${livro.autor || 'Sem Autor'}</td>
                <td><span class="badge-edicao">${livro.edicao || 'N/A'}</span></td>
                <td><span class="badge-genero">${livro.genero || 'N/A'}</span></td>
                <td><span class="status-count">${disponiveis}/${total}</span></td>
                <td>
                    <button class="btn-tags" onclick='abrirModalEtiquetas(${JSON.stringify(livro)})'>
                        <i class="bi bi-tag"></i> ${total}
                    </button>
                </td>
                <td>
                    <div class="tabela-acoes">
                        <button onclick="abrirEditarLivro('${livro.isbn}')" class="btn-edit" title="Editar livro">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button onclick="openDeleteBookModal('${livro.isbn}', '${livro.titulo.replace(/'/g, "\\'")}')" class="btn-delete" title="Excluir livro">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                </td>
            `;
            bookTableBody.appendChild(tr);
        });
    } catch (err) {
        console.error("Erro ao listar livros:", err.message);
        showToast("Erro ao carregar livros da tabela.", "error");
    }
}

formLivro.onsubmit = async (e) => {
    e.preventDefault();
    const isbnLimpo = document.getElementById('isbn').value.replace(/\D/g, ''); 
    const dadosLivro = {
        isbn: isbnLimpo,
        titulo: document.getElementById('titulo').value,
        autor: document.getElementById('autor').value,
        edicao: document.getElementById('edicao').value,
        ano: parseInt(document.getElementById('ano').value),
        genero: selectGenero.value
    };
    const etiquetas = Array.from(document.querySelectorAll('.input-etiqueta')).map(i => i.value);
    
    try {
        const { error: errL } = await supabaseClient.from('livros').insert([dadosLivro]);
        if (errL) throw errL;
        const exemplares = etiquetas.map(etiqueta => ({
            isbn_vinculado: isbnLimpo,
            status: 'Disponível',
            codigo_rfid: etiqueta
        }));
        if (exemplares.length > 0) {
            const { error: errE } = await supabaseClient.from('exemplares').insert(exemplares);
            if (errE) throw errE;
        }
        showToast("Livro cadastrado com sucesso!");
        formLivro.reset();
        areaCadastro.style.display = "none";
        areaListagem.style.display = "block";
        listarLivros();
        atualizarBarraDeGeneros();
    } catch (error) { alert("Erro: " + error.message); }
};

function abrirModalEtiquetas(livro) {
    const modal = document.getElementById("modalEtiquetas");
    const container = document.getElementById("modalEtiquetasGrid");
    document.getElementById("modalEtiquetasTitulo").textContent = livro.titulo;
    document.getElementById("modalTotalEtiquetas").textContent = `Total: ${livro.exemplares.length}`;
    container.innerHTML = "";
    livro.exemplares.forEach((ex, i) => {
        container.innerHTML += `
            <div class="tag-card">
                <div class="tag-header">
                    <i class="bi bi-tag" style="color: #103fec;"></i>
                    <span class="tag-code">${ex.codigo_rfid || 'SEM RFID'}</span>
                </div>
                <div class="tag-body">
                    <p>Exemplar #${i + 1}</p>
                    <span class="badge-disponivel">${ex.status || 'Disponível'}</span>
                </div>
            </div>
        `;
    });
    modal.style.display = "flex";
}

let isbnParaDeletar = null;

// 1. Chamada quando clica na lixeira
function abrirModalExclusao(isbn, nomeLivro) {
    isbnParaDeletar = isbn;
    
    // Atualiza o nome do livro no texto do modal
    document.getElementById('nome-livro-modal').innerText = nomeLivro;
    
    // Mostra o modal (removendo uma classe 'hidden' ou mudando o display)
    document.getElementById('meu-modal').style.display = 'flex';
}

// 2. Chamada quando clica no botão "Cancelar" do modal
function fecharModal() {
    document.getElementById('meu-modal').style.display = 'none';
    isbnParaDeletar = null;
}

// 3. Chamada quando clica no botão "Excluir" (vermelho) do modal
async function confirmarDelecao() {
    if (!isbnParaDeletar) return;

    await supabaseClient
        .from('livros')
        .delete()
        .eq('isbn', isbnParaDeletar);

    fecharModal();
    listarLivros();
    atualizarBarraDeGeneros();
}

// --- DINÂMICA DE ETIQUETAS E MÁSCARA ISBN ---
inputQuantidade.addEventListener('input', function() {
    const qtd = parseInt(this.value);
    containerEtiquetas.innerHTML = '';
    if (qtd > 0 && qtd <= 50) {
        labelEtiquetas.style.display = 'block';
        helperEtiquetas.style.display = 'block';
        for (let i = 1; i <= qtd; i++) {
            const grupo = document.createElement('div');
            grupo.className = 'form-group';
            grupo.style.width = 'calc(25% - 15px)';
                // Dentro do seu loop for (onde i é o contador):
grupo.innerHTML = `
    <label>RFID ${i}</label>
    <input 
        type="text" 
        class="input-etiqueta" 
        placeholder="Exemplar ${i}" 
        maxlength="10" 
        oninput="this.value = this.value.replace(/\\D/g, '')"
        required>
`;
            containerEtiquetas.appendChild(grupo);
        }
    } else {
        labelEtiquetas.style.display = 'none';
        helperEtiquetas.style.display = 'none';
    }
});

if (inputIsbn) {
    inputIsbn.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 13);
        let f = '';
        if (v.length > 0) f += v.substring(0, 3);
        if (v.length > 3) f += '-' + v.substring(3, 5);
        if (v.length > 5) f += '-' + v.substring(5, 8);
        if (v.length > 8) f += '-' + v.substring(8, 12);
        if (v.length > 12) f += '-' + v.substring(12, 13);
        e.target.value = f;
    });
}

// Variável global para o livro
let isbnParaExcluir = null;

function openDeleteBookModal(isbn, titulo) {
    isbnParaExcluir = isbn;
    document.getElementById('nomeLivroExcluir').textContent = titulo;
    document.getElementById('isbnLivroExcluirInfo').textContent = 'ISBN: ' + isbn;
    document.getElementById('deleteBookModal').classList.add('ativo');
    document.body.style.overflow = 'hidden';
}
function closeDeleteBookModal() {
    document.getElementById('deleteBookModal').classList.remove('ativo');
    document.body.style.overflow = '';
    isbnParaExcluir = null;
}
function fecharDeleteLivro(event) {
    if (event && event.target !== document.getElementById('deleteBookModal')) return;
    closeDeleteBookModal();
}

// Lógica de confirmação de exclusão do Livro (Protegida)
const btnConfirmDeleteBook = document.getElementById('confirmDeleteBookBtn');

if (btnConfirmDeleteBook) {
    btnConfirmDeleteBook.onclick = async function() {
        if (!isbnParaExcluir) return;

        try {
            // 1. Deletar exemplares primeiro
            const { error: errEx } = await supabaseClient
                .from('exemplares')
                .delete()
                .eq('isbn_vinculado', isbnParaExcluir);
            
            if (errEx) throw errEx;

            // 2. Deletar o livro
            const { error: errLivro } = await supabaseClient
                .from('livros')
                .delete()
                .eq('isbn', isbnParaExcluir);

            if (errLivro) throw errLivro;

            showToast("Livro e exemplares excluídos com sucesso!");
            closeDeleteBookModal();
            listarLivros(); 
            atualizarBarraDeGeneros();

        } catch (error) {
            showToast("Erro ao excluir livro: " + error.message, "error");
            closeDeleteBookModal();
        }
    };
} else {
    console.warn("Aviso: Botão 'confirmDeleteBookBtn' não encontrado no HTML.");
}

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
listarLivros();
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

/* ================================================================
   EDITAR LIVRO
   ================================================================ */
async function abrirEditarLivro(isbn) {
    try {
        const { data, error } = await supabaseClient.from('livros').select('*').eq('isbn', isbn).single();
        if (error || !data) { showToast('Erro ao carregar livro.', 'error'); return; }

        document.getElementById('editIsbn').value = isbn;
        document.getElementById('editIsbnLabel').textContent = 'ISBN: ' + isbn;
        document.getElementById('editTitulo').value = data.titulo || '';
        document.getElementById('editAutor').value  = data.autor  || '';
        document.getElementById('editEdicao').value = data.edicao || '';
        document.getElementById('editAno').value    = data.ano    || '';

        const { data: generos } = await supabaseClient.from('generos').select('*').order('nome');
        const sel = document.getElementById('editGenero');
        sel.innerHTML = '<option value="">Selecione...</option>';
        (generos || []).forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.nome; opt.textContent = g.nome;
            if (g.nome === data.genero) opt.selected = true;
            sel.appendChild(opt);
        });

        document.getElementById('modalEditarLivro').classList.add('ativo');
        document.body.style.overflow = 'hidden';
    } catch(e) { showToast('Erro ao abrir edição.', 'error'); }
}

function fecharEditarLivro(event) {
    if (event && event.target !== document.getElementById('modalEditarLivro')) return;
    document.getElementById('modalEditarLivro').classList.remove('ativo');
    document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formEditarLivro');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const isbn = document.getElementById('editIsbn').value;
        const payload = {
            titulo: document.getElementById('editTitulo').value.trim(),
            autor:  document.getElementById('editAutor').value.trim(),
            edicao: document.getElementById('editEdicao').value.trim(),
            ano:    parseInt(document.getElementById('editAno').value) || null,
            genero: document.getElementById('editGenero').value,
        };
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        const { error } = await supabaseClient.from('livros').update(payload).eq('isbn', isbn);
        btn.disabled = false;
        if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); }
        else {
            showToast('Livro atualizado com sucesso!');
            fecharEditarLivro();
            listarLivros();
            atualizarBarraDeGeneros();
        }
    });
});