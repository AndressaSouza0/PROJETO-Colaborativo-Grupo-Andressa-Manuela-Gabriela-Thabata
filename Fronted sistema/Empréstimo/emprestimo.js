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

    function normalizarTexto(str) {
        return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const termo = normalizarTexto(searchInput.value);
            const bookTableBody = document.getElementById('bookTableBody');
            const linhas = bookTableBody.querySelectorAll('tr');
            let visiveis = 0;
            linhas.forEach(tr => {
                const texto = normalizarTexto(tr.textContent);
                const mostra = !termo || texto.includes(termo);
                tr.style.display = mostra ? '' : 'none';
                if (mostra) visiveis++;
            });
            noDataMessage.style.display = (visiveis === 0) ? 'block' : 'none';
            noDataMessage.textContent = termo ? `Nenhum resultado para "${searchInput.value}"` : 'Nenhum empréstimo registrado';
        });
    }
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

// --- BUSCA POR ETIQUETA (RFID ou Código Interno) ---
async function buscarExemplarPorCodigo(codigo) {
    loadingLivro.style.display = "flex";
    cardLivro.style.display = "none";

    try {
        const isCodigoInterno = codigo.toUpperCase().startsWith('LIV-');
        const coluna = isCodigoInterno ? 'codigo_interno' : 'codigo_rfid';

        const { data, error } = await supabaseClient
            .from('exemplares')
            .select(`
                id,
                codigo_rfid,
                codigo_interno,
                status,
                livros (isbn, titulo, autor, edicao, ano)
            `)
            .eq(coluna, isCodigoInterno ? codigo.toUpperCase() : codigo)
            .maybeSingle();

        if (error) {
            showToast("Erro na conexão: " + error.message, "error");
            return;
        }

        if (!data) {
            showToast(`Código "${codigo}" não encontrado. Use a tag RFID ou o código interno (LIV-XXXX).`, "error");
            rfidInput.value = "";
            return;
        }

        if (data.status === 'Emprestado') {
            showToast("Bloqueado: Este exemplar já está com outro aluno!", "error");
            rfidInput.value = "";
            return;
        }

        exemplarSelecionado = data;
        livroSelecionado = data.livros;

        const etiquetaTexto = data.codigo_interno
            ? `${data.codigo_interno}${data.codigo_rfid ? ' (RFID: ' + data.codigo_rfid + ')' : ''}`
            : data.codigo_rfid || '-';
        if(document.getElementById('resEtiqueta')) document.getElementById('resEtiqueta').innerText = etiquetaTexto;

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
    }
}

rfidInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const codigo = rfidInput.value.trim();
        if (!codigo) return;
        await buscarExemplarPorCodigo(codigo);
    }
});

const btnLerTag = document.getElementById('btnLerTag');
if (btnLerTag) {
    btnLerTag.addEventListener('click', async () => {
        const codigo = rfidInput.value.trim();
        if (!codigo) {
            showToast("Digite o código da etiqueta (ex: LIV-0001).", "error");
            return;
        }
        await buscarExemplarPorCodigo(codigo);
    });
}

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
    if (btnFinalizar.disabled) return;

    btnFinalizar.disabled = true;
    btnFinalizar.innerHTML = '<i class="bi bi-arrow-repeat spinning"></i> Salvando...';

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

        // 3. Atualiza a lista imediatamente e fecha o formulário
        fecharCadastro();
        listarEmprestimos();

        // 4. ENVIAR MENSAGENS PELO WHATSAPP (independente do banco — não bloqueia o fluxo)
        if (alunoSelecionado.telefone && typeof ChatbotAPI !== 'undefined') {
            const dataDevolucaoFormatada = dataPrevista.toLocaleDateString('pt-BR');
            const tituloLivro = livroSelecionado?.titulo || exemplarSelecionado?.codigo_interno || 'Livro';

            try {
                const respPrimeiro = await fetch(`${ChatbotAPI.baseUrl}/api/primeiro-emprestimo/${alunoSelecionado.ra}`);
                const dadosPrimeiro = await respPrimeiro.json();
                if (dadosPrimeiro.primeiro) {
                    await ChatbotAPI.enviarBoasVindas(alunoSelecionado.nome_aluno, alunoSelecionado.telefone);
                }
            } catch {}

            try {
                const resultado = await ChatbotAPI.enviarConfirmacaoEmprestimo(
                    alunoSelecionado.nome_aluno,
                    alunoSelecionado.telefone,
                    tituloLivro,
                    dataDevolucaoFormatada
                );

                if (resultado.sucesso) {
                    showToast("Empréstimo registrado e mensagem enviada com sucesso!");
                } else {
                    showToast("Empréstimo registrado! Mensagem não enviada: WhatsApp desconectado.", "error");
                }
            } catch {
                showToast("Empréstimo registrado com sucesso!");
            }
        } else {
            showToast("Empréstimo registrado com sucesso!");
        }

    } catch (err) {
        console.error("Erro completo:", err);
        showToast("Erro ao salvar: " + (err.message || "Verifique as colunas do banco"), "error");
        btnFinalizar.disabled = false;
        btnFinalizar.innerHTML = 'Finalizar Empréstimo';
    }
};

// --- LISTAGEM COM FILTRO E CONTADORES ---
async function listarEmprestimos() {
    const { data: emprestimos, error } = await supabaseClient
        .from('emprestimos')
        .select(`
            id, created_at, data_prevista, status,
            alunos (nome_aluno),
            exemplares (id, codigo_rfid, codigo_interno, livros (titulo))
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
    document.getElementById('count-devolvidos').innerText = `(${listaProcessada.filter(e => e.statusExibicao === 'Devolvido').length})`;

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
            <td>${emp.exemplares?.codigo_interno || emp.exemplares?.codigo_rfid || 'N/A'}</td>
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
    btn.innerHTML = '<i class="bi bi-arrow-repeat spinning"></i> Confirmando...';

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

        document.getElementById('modalDevolucao').classList.remove('ativo');
        document.body.style.overflow = '';
        listarEmprestimos();

        // Enviar WhatsApp (não bloqueia nem impede o registro da devolução)
        if (empDados?.alunos?.telefone && typeof ChatbotAPI !== 'undefined') {
            try {
                const resultadoMsg = await ChatbotAPI.enviarConfirmacaoDevolucao(
                    empDados.alunos.nome_aluno,
                    empDados.alunos.telefone,
                    empDados.exemplares?.livros?.titulo || 'livro'
                );
                if (resultadoMsg.sucesso) {
                    showToast("Devolução registrada e mensagem enviada com sucesso!");
                } else {
                    showToast("Devolução registrada! Mensagem não enviada: WhatsApp desconectado.", "error");
                }
            } catch {
                showToast("Devolução registrada com sucesso!");
            }
        } else {
            showToast("Devolução registrada com sucesso!");
        }

    } catch (err) {
        console.error("Erro na devolução:", err);
        showToast("Erro na devolução: " + (err.message || "Consulte o console"), "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Confirmar devolução';
        _devEmprestimoId = null; _devExemplarId = null;
    }
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