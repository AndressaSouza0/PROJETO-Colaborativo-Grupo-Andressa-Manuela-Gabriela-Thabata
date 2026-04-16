// --- CONFIGURAÇÃO SUPABASE ---
const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iohL9m1D0GaAyHclfDCH9g_7p9sUih8'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- SELETORES ---
const modalLivro = document.getElementById("modalLivro");
const modalGenero = document.getElementById("modalGenero");
const formLivro = document.getElementById("formCadastro");
const formGenero = document.getElementById("formGenero");
const bookList = document.getElementById("bookList");
const genresTabs = document.getElementById("genresTabs");
const selectGenero = document.getElementById('genero-select');
const inputQuantidade = document.getElementById('quantidade_total');
const containerRfids = document.getElementById('container-rfids');

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    fetchLivros();   
    fetchGeneros();  
});

// --- CONTROLE DE MODAIS ---
function abrirModalLivro() { modalLivro.style.display = "block"; }

function fecharModais() {
    modalLivro.style.display = "none";
    if (modalGenero) modalGenero.style.display = "none";
    if (containerRfids) containerRfids.innerHTML = '';
}

document.querySelectorAll(".close-btn").forEach(btn => {
    btn.onclick = fecharModais;
});

window.onclick = (event) => {
    if (event.target == modalLivro || event.target == modalGenero) {
        fecharModais();
    }
};

if (document.getElementById("openModal")) {
    document.getElementById("openModal").onclick = abrirModalLivro;
}
if (document.getElementById("openModalGenero")) {
    document.getElementById("openModalGenero").onclick = () => modalGenero.style.display = "block";
}

// --- LÓGICA DE GÊNEROS ---
async function fetchGeneros() {
    const { data: generos, error } = await supabaseClient
        .from('generos')
        .select('*')
        .order('nome');

    if (error) return console.error("Erro ao buscar gêneros:", error.message);

    if (genresTabs) {
        genresTabs.innerHTML = `<button class="tab-item active" onclick="filtrarLivrosPorGenero('todos')">Todos</button>`;
        generos.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'tab-item';
            btn.textContent = g.nome;
            btn.onclick = () => {
                document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                filtrarLivrosPorGenero(g.nome);
            };
            genresTabs.appendChild(btn);
        });
    }

    if (selectGenero) {
        selectGenero.innerHTML = '<option value="">Selecione um gênero</option>';
        generos.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.nome;
            opt.textContent = g.nome;
            selectGenero.appendChild(opt);
        });
    }

    const listaModal = document.getElementById('lista-generos-cadastrados');
    const countSpan = document.getElementById('count-generos');
    
    if (listaModal) {
        if (countSpan) countSpan.innerText = generos.length;
        
        if (generos.length === 0) {
            listaModal.style.display = "flex";
            listaModal.innerHTML = '<p style="color: #999; padding: 20px;">Nenhum gênero cadastrado</p>';
        } else {
            listaModal.style.display = "block";
            listaModal.innerHTML = generos.map(g => `
                <div class="genero-item-lista" style="display:flex; justify-content:space-between; align-items:center; padding: 10px; border-bottom: 1px solid #eee;">
                    <span>${g.nome}</span>
                    <button onclick="deletarGenero(${g.id})" style="color:#ff4d4d; border:none; background:none; cursor:pointer; font-size: 1.1rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }
    }
}

if (formGenero) {
    formGenero.onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('nome-genero-input');
        const nomeNovo = input.value.trim();
        if (!nomeNovo) return;

        const { error } = await supabaseClient.from('generos').insert([{ nome: nomeNovo }]);
        if (error) alert("Erro ao adicionar: " + error.message);
        else {
            input.value = "";
            await fetchGeneros();
        }
    };
}

async function deletarGenero(id) {
    if (confirm("Deseja realmente excluir este gênero?")) {
        const { error } = await supabaseClient.from('generos').delete().eq('id', id);
        if (error) {
            if (error.code === '23503') alert("Não é possível excluir: existem livros vinculados.");
            else alert("Erro ao excluir: " + error.message);
        } else await fetchGeneros();
    }
}

// --- FILTRO E BUSCA DE LIVROS (AGRUPADO) ---
async function fetchLivros() {
    // Buscamos da tabela 'livros' e trazemos os exemplares relacionados
    const { data, error } = await supabaseClient
        .from('livros')
        .select(`
            isbn, titulo, autor, edicao, genero, ano_edicao,
            exemplares (id, codigo_rfid)
        `)
        .order('created_at', { ascending: false });

    if (error) return console.error("Erro:", error.message);
    renderizarLivros(data);
}

async function filtrarLivrosPorGenero(generoNome) {
    let query = supabaseClient
        .from('livros')
        .select(`
            isbn, titulo, autor, edicao, genero, ano_edicao,
            exemplares (id, codigo_rfid)
        `);

    if (generoNome !== 'todos') {
        query = query.eq('genero', generoNome);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) console.error(error);
    else renderizarLivros(data);
}

function renderizarLivros(livros) {
    if (!bookList) return;
    if (!livros || livros.length === 0) {
        bookList.innerHTML = '<p style="text-align:center; width:100%; color:#888; padding: 20px;">Nenhum livro encontrado.</p>';
        return;
    }

    bookList.innerHTML = livros.map(livro => `
        <div class="book-card">
            <button onclick="deletarLivroCompleto('${livro.isbn}')" class="btn-delete-card" title="Excluir livro e todos os exemplares">
                <i class="fas fa-trash-alt"></i>
            </button>
            <h3>${livro.titulo}</h3>
            <p style="color: #666; margin-bottom: 15px;">${livro.autor}</p>
            <div class="book-grid">
                <div class="info-item"><label>ISBN</label><span>${livro.isbn}</span></div>
                <div class="info-item"><label>Gênero</label><span>${livro.genero || '-'}</span></div>
                <div class="info-item"><label>Ano</label><span>${livro.ano_edicao || '-'}</span></div>
                <div class="info-item"><label>Unidades</label><span>${livro.exemplares ? livro.exemplares.length : 0}</span></div>
            </div>
            <div style="margin-top:10px; font-size:0.75rem; color:#999; word-break: break-all;">
                <strong>Tags:</strong> ${livro.exemplares ? livro.exemplares.map(e => e.codigo_rfid).join(', ') : 'Nenhuma'}
            </div>
        </div>
    `).join('');
}

// --- EXCLUSÃO EM CASCATA ---
async function deletarLivroCompleto(isbn) {
    if (confirm("Isso removerá o livro e TODAS as suas unidades físicas. Confirma?")) {
        // Graças ao ON DELETE CASCADE, deletar o livro já deleta os exemplares no banco
        const { error } = await supabaseClient.from('livros').delete().eq('isbn', isbn);
        
        if (error) alert("Erro ao deletar: " + error.message);
        else await fetchLivros();
    }
}

// --- LÓGICA DE RFID ---
if (inputQuantidade) {
    inputQuantidade.addEventListener('input', () => {
        const qtd = parseInt(inputQuantidade.value);
        containerRfids.innerHTML = ''; 
        if (qtd > 0) {
            for (let i = 1; i <= qtd; i++) {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'rfid-input';
                input.placeholder = `Tag RFID da unidade ${i}`;
                input.required = true;
                input.style = "width: 100%; margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 8px;";
                containerRfids.appendChild(input);
            }
        }
    });
}

if (formLivro) {
    formLivro.onsubmit = async (e) => {
        e.preventDefault();
        const btnSubmit = formLivro.querySelector('.btn-submit');
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Cadastrando...";

        const isbn = document.getElementById('isbn').value;

        const { error: errLivro } = await supabaseClient.from('livros').upsert({
            isbn: isbn,
            titulo: document.getElementById('titulo').value,
            autor: document.getElementById('autor').value,
            edicao: document.getElementById('edicao').value,
            genero: selectGenero.value,
            ano_edicao: parseInt(document.getElementById('Ano').value)
        });

        if (errLivro) {
            alert("Erro ao salvar livro: " + errLivro.message);
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Cadastrar Livro";
            return;
        }

        const rfidInputs = document.querySelectorAll('.rfid-input');
        const novosExemplares = Array.from(rfidInputs).map(input => ({
            codigo_rfid: input.value.trim(),
            isbn_vinculado: isbn
        }));

        const { error: errEx } = await supabaseClient.from('exemplares').insert(novosExemplares);

        if (errEx) alert("Erro ao salvar tags RFID: " + errEx.message);
        else {
            alert("Sucesso!");
            formLivro.reset();
            fecharModais();
            await fetchLivros();
        }
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Cadastrar Livro";
    };
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const content = document.querySelector('.content');
    if (!sidebar || !content) return;
    sidebar.classList.toggle('collapsed');
    content.style.marginLeft = sidebar.classList.contains('collapsed') ? "70px" : "260px";
}