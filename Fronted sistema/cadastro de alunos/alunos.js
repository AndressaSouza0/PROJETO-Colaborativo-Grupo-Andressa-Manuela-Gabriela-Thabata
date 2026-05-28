const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z3R3ZGNkanRic2xjYXZlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQxNTgsImV4cCI6MjA5MDY1MDE1OH0.TlvsoZkzLjKimaqvqMrekWLlWL7dvOfLtimJOTr8htU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
            <td>${aluno.serie} - ${aluno.turma}</td>
            <td>${aluno.ensino}</td>
            <td>${aluno.email_institucional}</td>
            <td><span class="status-badge ${statusClass}">${aluno.status || 'Ativo'}</span></td>
            <td>
                <div class="acoes-container">
                    <button class="btn-action ${btnClass}" onclick="alternarStatus('${aluno.ra}', '${aluno.status}')" title="Alternar Status">
                        <i class="bi ${btnIcon}"></i>
                    </button></td>
                    <td><button class="btn-delete" onclick="openDeleteModal('${aluno.ra}', '${aluno.nome_aluno}')" title="Excluir">
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
        instituicao: document.getElementById('instituicao').value
    };

    const { error } = await supabaseClient.from('alunos').insert([dados]);
    if (error) alert("Erro ao cadastrar: " + error.message);
    else {
        fecharCadastro();
        listarAlunos();
    }
};

// Deletar Aluno
let raParaExcluir = null;
function openDeleteModal(ra, nome) {
    raParaExcluir = ra;
    document.getElementById('nomeAlunoExcluir').textContent = nome;
    document.getElementById('deleteModal').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

document.getElementById('confirmDeleteBtn').onclick = async () => {
    await supabaseClient.from('alunos').delete().eq('ra', raParaExcluir);
    fecharModal();
    listarAlunos();
};

function toggleSidebar() {
    // 1. Seleciona a sidebar (ajuste o seletor se a sua tiver um ID ou classe diferente)
    const sidebar = document.querySelector('.sidebar'); 
    
    // 2. Liga/Desliga a classe que encolhe a barra
    sidebar.classList.toggle('collapsed');
    
    // 3. Muda o ícone de seta para a direita ou esquerda
    const icon = document.getElementById('menu-icon');
    if (sidebar.classList.contains('collapsed')) {
        icon.className = 'bi bi-caret-right'; // Seta pra direita quando fechado
    } else {
        icon.className = 'bi bi-caret-left';  // Seta pra esquerda quando aberto
    }
}

// Inicialização
listarAlunos();