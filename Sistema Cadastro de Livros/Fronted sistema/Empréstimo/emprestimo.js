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

        // 3. CHAMADA DA EDGE FUNCTION DO SUPABASE PARA ENVIO DE E-MAIL
        // Enviamos os dados para a função que criamos no Supabase
        const { data: emailData, error: emailError } = await supabaseClient.functions.invoke('confirmacao-emprestimo', {
            body: {
                email: alunoSelecionado.email_institucional, // Nome da coluna no seu banco
                nome: alunoSelecionado.nome_aluno,
                livro: livroSelecionado.titulo,
                dataEmprestimo: hoje.toLocaleDateString('pt-BR'),
                dataDevolucao: dataPrevista.toLocaleDateString('pt-BR')
            }
        });

        if (emailError) {
            console.error("Erro na função de e-mail:", emailError);
            showToast("Empréstimo salvo, mas o e-mail falhou.", "error");
        } else {
            showToast("Empréstimo registrado e e-mail enviado!");
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
            `<button onclick="devolverLivro('${emp.id}', '${emp.exemplares?.id}')" class="btn-return">
                <i class="bi bi-arrow-left-right"></i> Devolver
             </button>`
        }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function devolverLivro(emprestimoId, exemplarId) {
    if (!confirm("Confirmar a devolução deste exemplar?")) return;
    
    try {
        const { error: err1 } = await supabaseClient
            .from('emprestimos')
            .update({ status: 'Devolvido' })
            .eq('id', emprestimoId);

        if (err1) throw err1;

        const { error: err2 } = await supabaseClient
            .from('exemplares')
            .update({ status: 'Disponível' })
            .eq('id', exemplarId);

        if (err2) throw err2;

        showToast("Devolução registrada!");
        listarEmprestimos();

    } catch (err) {
        console.error("Detalhes do erro:", err);
        showToast("Erro na devolução: " + (err.message || "Consulte o console"), "error");
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar'); 
    sidebar.classList.toggle('collapsed');
    const icon = document.getElementById('menu-icon');
    icon.className = sidebar.classList.contains('collapsed') ? 'bi bi-caret-right' : 'bi bi-caret-left';
}