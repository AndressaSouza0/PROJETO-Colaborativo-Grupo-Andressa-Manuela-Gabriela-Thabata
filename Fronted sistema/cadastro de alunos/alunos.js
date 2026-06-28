const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z3R3ZGNkanRic2xjYXZlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQxNTgsImV4cCI6MjA5MDY1MDE1OH0.TlvsoZkzLjKimaqvqMrekWLlWL7dvOfLtimJOTr8htU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
    const icon = tipo === 'success'
        ? '<i class="bi bi-check-circle-fill"></i>'
        : '<i class="bi bi-x-circle-fill"></i>';
    const titulo = tipo === 'success' ? 'Sucesso' : 'Erro';
    toast.innerHTML = `
        <div class="toast-icon-wrap">${icon}</div>
        <div class="toast-body">
            <div class="toast-title">${titulo}</div>
            <span class="toast-message">${mensagem}</span>
        </div>
        <button class="toast-close"><i class="bi bi-x-lg"></i></button>
        <div class="toast-progress"></div>
    `;
    container.appendChild(toast);
    const dismiss = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(calc(100% + 24px))';
        toast.style.transition = 'all 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    };
    const timer = setTimeout(dismiss, 4000);
    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(timer);
        dismiss();
    });
}

// Seletores
const areaListagem = document.getElementById("area-listagem");
const areaCadastro = document.getElementById("area-cadastro");
const btnAbrirCadastro = document.getElementById("openModal");
const formAluno = document.getElementById("formCadastroAluno");
const studentTableBody = document.getElementById("studentTableBody");
const noDataMessage = document.getElementById("noDataMessage");

// Navegação
btnAbrirCadastro.onclick = () => {
    areaListagem.style.display = "none";
    areaCadastro.style.display = "block";
};

function fecharCadastro() {
    areaCadastro.style.display = "none";
    areaListagem.style.display = "block";
    formAluno.reset();
}

// Lógica de Séries Dinâmicas
function atualizarSeries() {
    const ensinoSelect = document.getElementById('ensino');
    const serieSelect = document.getElementById('serie');
    const instituicaoInput = document.getElementById('instituicao');

    const ensinoSelecionado = ensinoSelect.value;

    // Limpa as opções atuais da Série
    serieSelect.innerHTML = '<option value="">Selecione a série...</option>';

    if (ensinoSelecionado === "Fundamental") {
        // Regra para Fundamental
        instituicaoInput.value = "E.E. João Ramalho"; 
        
        const seriesFundamental = ["6°", "7°", "8°", "9°"];
        seriesFundamental.forEach(serie => {
            const option = document.createElement('option');
            option.value = serie;
            option.textContent = `${serie} Ano`;
            serieSelect.appendChild(option);
        });

    } else if (ensinoSelecionado === "Médio") {
        // Regra para Médio
        instituicaoInput.value = "E.E. Maria Nilde Mascellani"; 
        
        const seriesMedio = ["1°", "2°", "3°"];
        seriesMedio.forEach(serie => {
            const option = document.createElement('option');
            option.value = serie;
            option.textContent = `${serie} Série`;
            serieSelect.appendChild(option);
        });
    } else {
        // Caso nada esteja selecionado
        instituicaoInput.value = "";
        serieSelect.innerHTML = '<option value="">Selecione o ensino primeiro</option>';
    }
}

// 3. CORREÇÃO NAS FUNÇÕES: Troque 'supabaseClient' por 'supabase'
async function listarAlunos() {
    // Note que mudei de supabaseClient para apenas supabase
    const { data, error } = await supabaseClient.from('alunos').select('*').order('nome_aluno');
    
    if (error) {
        console.error("Erro na requisição:", error);
        return;
    }

    studentTableBody.innerHTML = "";
    if (!data || data.length === 0) {
        noDataMessage.style.display = "block";
    } else {
        noDataMessage.style.display = "none";
       data.forEach(aluno => {
    // Define a cor e o ícone baseado no status
    const isBloqueado = aluno.status === 'Bloqueado';
    const statusClass = isBloqueado ? 'badge-bloqueado' : 'badge-ativo';
    const btnIcon = isBloqueado ? 'bi-check-circle' : 'bi-slash-circle';
    const btnClass = isBloqueado ? 'btn-ativar' : 'btn-bloquear';

    studentTableBody.innerHTML += `
        <tr>
            <td>${aluno.ra}</td>
            <td>${aluno.nome_aluno}</td>
            <td>${aluno.serie || '—'} - ${aluno.turma || '—'}</td>
            <td>${aluno.ensino || '—'}</td>
            <td>${aluno.instituicao || '—'}</td>
            <td>${aluno.email_institucional || '—'}</td>
            <td><span class="status-badge ${statusClass}">${aluno.status || 'Ativo'}</span></td>
            <td>
                <div class="tabela-acoes">
                    <button class="btn-edit" onclick="abrirEditarAluno('${aluno.ra}')" title="Editar aluno">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-action ${btnClass}" onclick="alternarStatus('${aluno.ra}', '${aluno.status}')" title="${isBloqueado ? 'Ativar aluno' : 'Bloquear aluno'}">
                        <i class="bi ${btnIcon}"></i>
                    </button>
                    <button class="btn-delete" onclick="openDeleteModal('${aluno.ra}', '${aluno.nome_aluno}')" title="Excluir aluno">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
});

    }

}

async function alternarStatus(ra, statusAtual) {
    const novoStatus = (statusAtual === 'Bloqueado') ? 'Ativo' : 'Bloqueado';

    const { error } = await supabaseClient
        .from('alunos')
        .update({ status: novoStatus })
        .eq('ra', ra);

    if (error) {
        alert("Erro ao atualizar status: " + error.message);
    } else {
        listarAlunos(); // Recarrega a tabela para mostrar a mudança
    }
}

// Máscara de telefone — formata automaticamente enquanto o usuário digita
// Suporta celular (11 dígitos): (11) 99999-9999
// Suporta fixo  (10 dígitos): (11) 9999-9999
function mascaraTelefone(input) {
    let v = input.value.replace(/\D/g, '').substring(0, 11);

    if      (v.length === 11) v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    else if (v.length === 10) v = v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    else if (v.length  >  6)  v = v.replace(/(\d{2})(\d{4,5})/, '($1) $2');
    else if (v.length  >  2)  v = v.replace(/(\d{2})(\d*)/, '($1) $2');
    else if (v.length  >  0)  v = `(${v}`;

    input.value = v;
}

// Salvar Cadastro
formAluno.onsubmit = async (e) => {
    e.preventDefault();
    const dados = {
        ra: document.getElementById('ra').value,
        nome_aluno: document.getElementById('nome_aluno').value,
        email_institucional: document.getElementById('email_institucional').value,
        ensino: document.getElementById('ensino').value,
        serie: document.getElementById('serie').value,
        turma: document.getElementById('turma').value,
        instituicao: document.getElementById('instituicao').value,
        telefone: document.getElementById('telefone').value || null
    };

    const { error } = await supabaseClient.from('alunos').insert([dados]);
    if (error) {
        showToast("Erro ao cadastrar: " + error.message, "error");
    } else {
        showToast("Aluno cadastrado com sucesso!");
        fecharCadastro();
        listarAlunos();
    }
};

let raParaExcluir = null;
function openDeleteModal(ra, nome) {
    raParaExcluir = ra;
    document.getElementById('nomeAlunoExcluir').textContent = nome;
    document.getElementById('raAlunoExcluirInfo').textContent = 'RA: ' + ra;
    document.getElementById('deleteModal').classList.add('ativo');
    document.body.style.overflow = 'hidden';
}
function fecharModal() {
    document.getElementById('deleteModal').classList.remove('ativo');
    document.body.style.overflow = '';
}
function fecharDeleteAluno(event) {
    if (event && event.target !== document.getElementById('deleteModal')) return;
    fecharModal();
}

document.getElementById('confirmDeleteBtn').onclick = async () => {
    const { error } = await supabaseClient.from('alunos').delete().eq('ra', raParaExcluir);
    fecharModal();
    if (error) {
        showToast("Erro ao excluir aluno: " + error.message, "error");
    } else {
        showToast("Aluno excluído com sucesso!");
    }
    listarAlunos();
};

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

// Inicialização
listarAlunos();

/* ================================================================
   BUSCA POR TEXTO — ALUNOS
   ================================================================ */
(function() {
    function normalizarTexto(str) {
        return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const termo = normalizarTexto(searchInput.value);
            const linhas = studentTableBody.querySelectorAll('tr');
            let visiveis = 0;
            linhas.forEach(tr => {
                const texto = normalizarTexto(tr.textContent);
                const mostra = !termo || texto.includes(termo);
                tr.style.display = mostra ? '' : 'none';
                if (mostra) visiveis++;
            });
            noDataMessage.style.display = (visiveis === 0) ? 'block' : 'none';
            noDataMessage.textContent = termo ? `Nenhum aluno encontrado para "${searchInput.value}"` : 'Nenhum aluno registrado';
        });
    }
})();

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
   EDITAR ALUNO
   ================================================================ */
async function abrirEditarAluno(ra) {
    try {
        const { data, error } = await supabaseClient.from('alunos').select('*').eq('ra', ra).single();
        if (error || !data) { alert('Erro ao carregar aluno.'); return; }

        document.getElementById('editRa').value = ra;
        document.getElementById('editRaLabel').textContent = 'RA: ' + ra;
        document.getElementById('editNomeAluno').value = data.nome_aluno || '';
        document.getElementById('editTurma').value = data.turma || '';
        document.getElementById('editTelefone').value = data.telefone || '';
        document.getElementById('editEmailInstitucional').value = data.email_institucional || '';
        document.getElementById('editEnsino').value = data.ensino || '';
        atualizarSeriesEdicao();
        setTimeout(() => { document.getElementById('editSerie').value = data.serie || ''; }, 50);

        document.getElementById('modalEditarAluno').classList.add('ativo');
        document.body.style.overflow = 'hidden';
    } catch(e) { alert('Erro ao abrir edição do aluno.'); }
}

function atualizarSeriesEdicao() {
    const ensino = document.getElementById('editEnsino').value;
    const sel = document.getElementById('editSerie');
    const fund = ['6°', '7°', '8°', '9°'];
    const medio = ['1°', '2°', '3°'];
    const series = ensino === 'Fundamental' ? fund : ensino === 'Médio' ? medio : [];
    const labelFn = (s) => ensino === 'Fundamental' ? `${s} Ano` : `${s} Série`;
    sel.innerHTML = series.length === 0
        ? '<option value="">Selecione o ensino primeiro</option>'
        : series.map(s => `<option value="${s}">${labelFn(s)}</option>`).join('');
}

function fecharEditarAluno(event) {
    if (event && event.target !== document.getElementById('modalEditarAluno')) return;
    document.getElementById('modalEditarAluno').classList.remove('ativo');
    document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formEditarAluno');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ra = document.getElementById('editRa').value;
        const payload = {
            nome_aluno:          document.getElementById('editNomeAluno').value.trim(),
            ensino:              document.getElementById('editEnsino').value,
            serie:               document.getElementById('editSerie').value,
            turma:               document.getElementById('editTurma').value.trim(),
            telefone:            document.getElementById('editTelefone').value.trim(),
            email_institucional: document.getElementById('editEmailInstitucional').value.trim(),
        };
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        const { error } = await supabaseClient.from('alunos').update(payload).eq('ra', ra);
        btn.disabled = false;
        if (error) { alert('Erro ao salvar: ' + error.message); }
        else { fecharEditarAluno(); listarAlunos(); }
    });
});