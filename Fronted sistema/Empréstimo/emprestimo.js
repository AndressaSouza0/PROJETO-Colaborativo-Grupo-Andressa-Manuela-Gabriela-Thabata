const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z3R3ZGNkanRic2xjYXZlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQxNTgsImV4cCI6MjA5MDY1MDE1OH0.TlvsoZkzLjKimaqvqMrekWLlWL7dvOfLtimJOTr8htU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- SELETORES GLOBAIS ---
const areaListagem = document.getElementById("area-listagem");
const areaCadastro = document.getElementById("area-cadastro");
const noDataMessage = document.getElementById("noDataMessage");
const rfidInput = document.getElementById("rfidInput");
const raInputEmprestimo = document.getElementById("raInput");
const loadingLivro = document.getElementById("loadingLivro");
const cardLivro = document.getElementById("cardLivroResult");
const cardAluno = document.getElementById("cardAlunoResult");
const stepAluno = document.getElementById("stepAluno");
const btnFinalizar = document.getElementById("btnFinalizarEmprestimo");

let livroSelecionado = null;
let alunoSelecionado = null;
let exemplarSelecionado = null;
let filtroAtual = 'todos';

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

// --- INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", () => {
    const btnAbrirCadastro = document.getElementById("openModal");
    const btnCancelar = document.getElementById("btnCancelarCadastro");

    if (btnAbrirCadastro) {
        btnAbrirCadastro.onclick = () => {
            areaListagem.style.display = "none"; 
            areaCadastro.style.display = "block";
            setTimeout(() => rfidInput.focus(), 50);
        };
    }
    if (btnCancelar) btnCancelar.onclick = fecharCadastro;

    document.querySelectorAll('.tab-item').forEach(button => {
        button.onclick = () => {
            document.querySelectorAll('.tab-item').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            filtroAtual = button.getAttribute('data-filter');
            listarEmprestimos();
        };
    });

    listarEmprestimos();
    verificarAvisosAutomaticos();
});

function fecharCadastro() {
    areaCadastro.style.display = "none";
    areaListagem.style.display = "block";
    resetarFormularioEmprestimo();
}

function resetarFormularioEmprestimo() {
    rfidInput.value = "";
    raInputEmprestimo.value = "";
    if(cardLivro) cardLivro.style.display = "none";
    if(cardAluno) cardAluno.style.display = "none";
    btnFinalizar.disabled = true;
    livroSelecionado = null;
    alunoSelecionado = null;
    exemplarSelecionado = null;
}

// --- BUSCA RFID (PASSO 1) ---
rfidInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const valorBruto = rfidInput.value;
        const tagId = valorBruto.replace(/\D/g, '');

        if (!tagId) {
            rfidInput.value = "";
            return;
        }

        loadingLivro.style.display = "flex";
        cardLivro.style.display = "none";

        try {
            const { data, error } = await supabaseClient
                .from('exemplares')
                .select(`
                    id, 
                    codigo_rfid, 
                    status, 
                    livros (isbn, titulo, autor, edicao, ano)
                `)
                .eq('codigo_rfid', tagId)
                .maybeSingle();

            if (error) {
                showToast("Erro na conexão: " + error.message, "error");
                return;
            }

            if (!data) {
                showToast(`Tag ${tagId} não encontrada.`, "error");
                rfidInput.value = "";
                return;
            }

            if (data.status === 'Emprestado') {
                showToast("⚠️ Bloqueado: Este exemplar já está com outro aluno!", "error");
                rfidInput.value = "";
                return;
            }

            exemplarSelecionado = data;
            livroSelecionado = data.livros;

            if(document.getElementById('resEtiqueta')) document.getElementById('resEtiqueta').innerText = data.codigo_rfid;
            
            if(livroSelecionado) {
                if(document.getElementById('resTitulo')) document.getElementById('resTitulo').innerText = livroSelecionado.titulo || '-';
                if(document.getElementById('resAutor')) document.getElementById('resAutor').innerText = livroSelecionado.autor || '-';
                if(document.getElementById('resIsbn')) document.getElementById('resIsbn').innerText = livroSelecionado.isbn || '-';
                if(document.getElementById('resEdicao')) document.getElementById('resEdicao').innerText = livroSelecionado.edicao || '-';
                if(document.getElementById('resAno')) document.getElementById('resAno').innerText = livroSelecionado.ano || '-';
            }

            cardLivro.style.display = "block";
            if (stepAluno) stepAluno.classList.remove("disabled");
            raInputEmprestimo.focus();

        } catch (err) {
            console.error("Erro inesperado:", err);
        } finally {
            loadingLivro.style.display = "none";
            rfidInput.value = tagId; 
        }
    }
});

// --- BUSCA ALUNO (PASSO 2) ---
document.getElementById('btnBuscarAluno').onclick = async () => {
    const ra = raInputEmprestimo.value.trim();
    if (!ra) {
        showToast("Por favor, insira o RA do aluno.", "error");
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('alunos')
            .select('*')
            .eq('ra', ra)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            showToast("Aluno não encontrado!", "error");
            cardAluno.style.display = 'none';
            return;
        }

        if(document.getElementById('resNomeAluno')) document.getElementById('resNomeAluno').innerText = data.nome_aluno;
        if(document.getElementById('resSerieTurma')) document.getElementById('resSerieTurma').innerText = `${data.serie} ${data.turma || ''} - ${data.ensino || ''}`;
        if(document.getElementById('resInstituicao')) document.getElementById('resInstituicao').innerText = data.instituicao;
        if(document.getElementById('resEmailinstitucional')) document.getElementById('resEmailinstitucional').innerText = data.email_institucional;
        if(document.getElementById('resStatusAluno')) document.getElementById('resStatusAluno').innerText = data.status || 'Ativo';

        alunoSelecionado = data;
        cardAluno.style.display = 'block';

        if (data.status === 'Bloqueado') {
            showToast("Este aluno está BLOQUEADO!", "error");
            btnFinalizar.disabled = true;
        } else if (exemplarSelecionado) {
            showToast("Aluno verificado com sucesso!");
            btnFinalizar.disabled = false; 
        }

    } catch (err) {
        console.error("Erro ao buscar aluno:", err);
        showToast("Erro ao consultar aluno.", "error");
    }
};

// --- FINALIZAR EMPRÉSTIMO ---
btnFinalizar.onclick = async () => {
    if (!alunoSelecionado || !exemplarSelecionado) return;

    const hoje = new Date();

    // Cálculo das datas
    const dataPrevista = new Date();
    dataPrevista.setDate(hoje.getDate() + 30);

    const dataAvisoPrevio = new Date();
    dataAvisoPrevio.setDate(hoje.getDate() + 23);

    const dataAvisoAtraso = new Date();
    dataAvisoAtraso.setDate(hoje.getDate() + 44);

    const dataPrevistaFormatada = dataPrevista.toISOString().split('T')[0];
    const dataAvisoFormatada = dataAvisoPrevio.toISOString().split('T')[0];
    const dataAtrasoFimFormatada = dataAvisoAtraso.toISOString().split('T')[0];

    try {
        // 1. Salvar no Banco de Dados
        const { error: errorEmp } = await supabaseClient.from('emprestimos').insert([{
            aluno_ra: alunoSelecionado.ra,
            exemplar_id: exemplarSelecionado.id,
            data_prevista: dataPrevistaFormatada,
            data_aviso_expiracao: dataAvisoFormatada,
            data_aviso_atraso: dataAtrasoFimFormatada,
            status: 'Ativo'
        }]);

        if (errorEmp) throw errorEmp;

        // 2. Atualizar status do exemplar
        const { error: errorEx } = await supabaseClient
            .from('exemplares')
            .update({ status: 'Emprestado' })
            .eq('id', exemplarSelecionado.id);

        if (errorEx) throw errorEx;

        // 3. ENVIAR MENSAGENS PELO WHATSAPP
        if (alunoSelecionado.telefone && typeof ChatbotAPI !== 'undefined') {
            const dataDevolucaoFormatada = dataPrevista.toLocaleDateString('pt-BR');

            await ChatbotAPI.enviarBoasVindas(
                alunoSelecionado.nome_aluno,
                alunoSelecionado.telefone
            );

            const resultado = await ChatbotAPI.enviarConfirmacaoEmprestimo(
                alunoSelecionado.nome_aluno,
                alunoSelecionado.telefone,
                livroSelecionado.titulo,
                dataDevolucaoFormatada
            );

            if (!resultado.sucesso) {
                console.warn("Aviso no envio da mensagem:", resultado.erro);
                showToast("Empréstimo salvo, mas a mensagem não foi enviada.", "error");
            } else {
                showToast("Empréstimo registrado e mensagem enviada com sucesso!");
            }
        } else {
            showToast("Empréstimo registrado com sucesso!");
        }

        fecharCadastro();
        if (typeof listarEmprestimos === 'function') listarEmprestimos();

    } catch (err) {
        console.error("Erro completo:", err);
        showToast("Erro ao salvar: " + (err.message || "Verifique as colunas do banco"), "error");
    }
};

// --- LISTAGEM COM FILTRO E CONTADORES ---
async function listarEmprestimos() {
    const { data: emprestimos, error } = await supabaseClient
        .from('emprestimos')
        .select(`
            id, created_at, data_prevista, status,
            alunos (nome_aluno),
            exemplares (id, codigo_rfid, livros (titulo))
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao listar:", error);
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const listaProcessada = emprestimos.map(emp => {
        const dataDevolucao = new Date(emp.data_prevista);
        dataDevolucao.setHours(0, 0, 0, 0);
        
        let statusCalculado = emp.status;
        if (emp.status === 'Ativo' && hoje > dataDevolucao) {
            statusCalculado = 'Atrasado';
        }
        return { ...emp, statusExibicao: statusCalculado };
    });

    document.getElementById('count-todos').innerText = `(${listaProcessada.length})`;
    document.getElementById('count-em-dia').innerText = `(${listaProcessada.filter(e => e.statusExibicao === 'Ativo').length})`;
    document.getElementById('count-atrasados').innerText = `(${listaProcessada.filter(e => e.statusExibicao === 'Atrasado').length})`;

    let listaFiltrada = listaProcessada;
    if (filtroAtual !== 'todos') {
        listaFiltrada = listaProcessada.filter(emp => emp.statusExibicao === filtroAtual);
    }

    renderizarTabela(listaFiltrada);
}

function renderizarTabela(emprestimos) {
    const tbody = document.getElementById("bookTableBody");
    if(!tbody) return;
    tbody.innerHTML = ""; 

    if (emprestimos.length === 0) {
        noDataMessage.style.display = "block";
        return;
    }

    noDataMessage.style.display = "none";
    emprestimos.forEach(emp => {
        const tr = document.createElement("tr");
        const status = emp.statusExibicao;

        tr.innerHTML = `
            <td>${emp.alunos?.nome_aluno || 'N/A'}</td>
            <td>${emp.exemplares?.livros?.titulo || 'N/A'}</td>
            <td>${emp.exemplares?.codigo_rfid || 'N/A'}</td>
            <td>${new Date(emp.created_at).toLocaleDateString('pt-BR')}</td>
            <td>${new Date(emp.data_prevista).toLocaleDateString('pt-BR')}</td>
            <td><span class="status-badge ${status}">${status}</span></td>
            <td id="acao-${emp.id}">
            ${status === 'Devolvido' ?
                `<button class="btn-devolvido" disabled>
                <i class="bi bi-check-circle"></i> Devolvido
             </button>` : 
            `<button onclick="abrirModalDevolucao('${emp.id}', '${emp.exemplares?.id}', '${(emp.exemplares?.livros?.titulo || '').replace(/'/g,"\\'")}', '${(emp.alunos?.nome_aluno || '').replace(/'/g,"\\'")}' )" class="btn-return">
                <i class="bi bi-arrow-left-right"></i> Devolver
             </button>`
        }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

let _devEmprestimoId = null, _devExemplarId = null;

function abrirModalDevolucao(emprestimoId, exemplarId, titulo, nomeAluno) {
    _devEmprestimoId = emprestimoId;
    _devExemplarId   = exemplarId;
    document.getElementById('devolucaoLivroTitulo').textContent = titulo  || 'Livro não identificado';
    document.getElementById('devolucaoAlunoNome').textContent   = nomeAluno || 'Aluno não identificado';
    document.getElementById('modalDevolucao').classList.add('ativo');
    document.body.style.overflow = 'hidden';
}

function fecharModalDevolucao(event) {
    if (event && event.target !== document.getElementById('modalDevolucao')) return;
    document.getElementById('modalDevolucao').classList.remove('ativo');
    document.body.style.overflow = '';
}

async function confirmarDevolucao() {
    if (!_devEmprestimoId) return;
    const btn = document.getElementById('btnConfirmarDevolucao');
    btn.disabled = true;
    try {
        const { data: empDados } = await supabaseClient
            .from('emprestimos')
            .select('alunos(nome_aluno, telefone), exemplares(livros(titulo))')
            .eq('id', _devEmprestimoId).maybeSingle();

        const { error: err1 } = await supabaseClient
            .from('emprestimos').update({ status: 'Devolvido' }).eq('id', _devEmprestimoId);
        if (err1) throw err1;

        const { error: err2 } = await supabaseClient
            .from('exemplares').update({ status: 'Disponível' }).eq('id', _devExemplarId);
        if (err2) throw err2;

        if (empDados?.alunos?.telefone && typeof ChatbotAPI !== 'undefined') {
            await ChatbotAPI.enviarConfirmacaoDevolucao(
                empDados.alunos.nome_aluno, empDados.alunos.telefone,
                empDados.exemplares?.livros?.titulo || 'livro'
            );
        }

        document.getElementById('modalDevolucao').classList.remove('ativo');
        document.body.style.overflow = '';
        showToast("Devolução registrada!");
        listarEmprestimos();
    } catch (err) {
        console.error("Erro na devolução:", err);
        showToast("Erro na devolução: " + (err.message || "Consulte o console"), "error");
    } finally {
        btn.disabled = false;
        _devEmprestimoId = null; _devExemplarId = null;
    }
}

async function devolverLivro(emprestimoId, exemplarId) {
}

// --- AVISOS AUTOMÁTICOS ---
async function verificarAvisosAutomaticos() {
    if (typeof ChatbotAPI === 'undefined') return;

    const hoje = new Date().toISOString().split('T')[0];

    const { data: expirando } = await supabaseClient
        .from('emprestimos')
        .select('id, data_prevista, alunos(nome_aluno, telefone), exemplares(livros(titulo))')
        .eq('data_aviso_expiracao', hoje)
        .eq('status', 'Ativo');

    for (const emp of (expirando || [])) {
        const chave = `notif_expiracao_${emp.id}`;
        if (localStorage.getItem(chave) || !emp.alunos?.telefone) continue;
        const dataFmt = _formatarDataAviso(emp.data_prevista);
        const res = await ChatbotAPI.enviarLembreteDevolvucao(
            emp.alunos.nome_aluno, emp.alunos.telefone,
            emp.exemplares?.livros?.titulo || 'livro', dataFmt
        );
        if (res.sucesso) localStorage.setItem(chave, '1');
    }

    const { data: atrasados } = await supabaseClient
        .from('emprestimos')
        .select('id, data_prevista, alunos(nome_aluno, telefone), exemplares(livros(titulo))')
        .eq('data_aviso_atraso', hoje)
        .eq('status', 'Ativo');

    for (const emp of (atrasados || [])) {
        const chave = `notif_atraso_${emp.id}`;
        if (localStorage.getItem(chave) || !emp.alunos?.telefone) continue;
        const dias = _calcDiasAtraso(emp.data_prevista);
        const res = await ChatbotAPI.enviarAvisoAtraso(
            emp.alunos.nome_aluno, emp.alunos.telefone,
            emp.exemplares?.livros?.titulo || 'livro', dias
        );
        if (res.sucesso) localStorage.setItem(chave, '1');
    }
}

function _formatarDataAviso(dateStr) {
    if (!dateStr) return '';
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
}

function _calcDiasAtraso(dataPrevista) {
    const diff = Math.floor((new Date() - new Date(dataPrevista)) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
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