// ================================================================
// chatbot.js — Lógica da tela de mensagens WhatsApp
// Arquitetura: browser-side (sem Node.js / sem require())
// Depende de: conexao-api.js (carregado antes) + Supabase SDK
// ================================================================

// --- SUPABASE ---
const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z3R3ZGNkanRic2xjYXZlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQxNTgsImV4cCI6MjA5MDY1MDE1OH0.TlvsoZkzLjKimaqvqMrekWLlWL7dvOfLtimJOTr8htU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO ---
let templateSelecionado = null;
let emprestimosAluno    = [];

// ================================================================
// TEMPLATES DE MENSAGEM
// ================================================================
const TEMPLATES = [
    {
        id: 'confirmacao_emprestimo',
        emoji: '📚',
        titulo: 'Confirmação de Empréstimo',
        descricao: 'Envia quando um livro é retirado',
        campos: ['titulo_livro', 'data_devolucao']
    },
    {
        id: 'lembrete_devolucao',
        emoji: '⏰',
        titulo: 'Lembrete de Devolução',
        descricao: 'Avisa sobre devolução próxima',
        campos: ['titulo_livro', 'data_devolucao']
    },
    {
        id: 'aviso_atraso',
        emoji: '⚠️',
        titulo: 'Aviso de Atraso',
        descricao: 'Para livros em atraso',
        campos: ['titulo_livro', 'dias_atraso']
    },
    {
        id: 'confirmacao_devolucao',
        emoji: '✅',
        titulo: 'Confirmação de Devolução',
        descricao: 'Quando o livro é devolvido',
        campos: ['titulo_livro']
    },
    {
        id: 'personalizada',
        emoji: '💬',
        titulo: 'Mensagem Personalizada',
        descricao: 'Escreva sua própria mensagem',
        campos: ['mensagem_custom']
    }
];

// ================================================================
// INICIALIZAÇÃO
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
    renderizarTemplates();
    await carregarAlunos();
    await verificarEAtualizarStatus();
    await carregarHistorico();

    // Verifica status a cada 30 segundos
    setInterval(verificarEAtualizarStatus, 30000);

    // Listener do formulário de envio
    document.getElementById('formEnviarMensagem').addEventListener('submit', handleEnviarMensagem);
});

// ================================================================
// STATUS DA CONEXÃO — badge no cabeçalho + área do QR Code
// ================================================================
async function verificarEAtualizarStatus() {
    const badge  = document.getElementById('statusConexao');
    const texto  = document.getElementById('statusTexto');
    const areaQR = document.getElementById('areaQRCode');

    badge.className  = 'status-badge-whatsapp status-verificando';
    texto.textContent = '● Verificando...';

    const resultado = await ChatbotAPI.verificarConexao();

    if (resultado.conectado) {
        badge.className  = 'status-badge-whatsapp status-conectado';
        texto.textContent = '● WhatsApp Conectado';
        areaQR.style.display = 'none';
    } else if (resultado.estado === 'erro') {
        badge.className  = 'status-badge-whatsapp status-erro';
        texto.textContent = '● Servidor offline';
        areaQR.style.display = 'none';
    } else {
        // Desconectado: exibe a área do QR Code
        badge.className  = 'status-badge-whatsapp status-desconectado';
        texto.textContent = '● Desconectado';
        areaQR.style.display = 'block';
        carregarQRCode();
    }
}

// ================================================================
// QR CODE — carrega e exibe a imagem base64 da Evolution API
// ================================================================
async function carregarQRCode() {
    const container = document.getElementById('qrCodeImg');
    container.innerHTML = `
        <i class="bi bi-arrow-repeat spinning" style="font-size:2rem;"></i>
        <span>Carregando QR Code...</span>
    `;

    const resultado = await ChatbotAPI.obterQRCode();

    if (resultado.sucesso) {
        container.innerHTML = `
            <img src="${resultado.qrCode}"
                 alt="QR Code WhatsApp"
                 style="width:220px;height:220px;border-radius:12px;border:3px solid var(--whatsapp-green);">
        `;
    } else {
        container.innerHTML = `
            <i class="bi bi-exclamation-circle" style="font-size:2rem;color:var(--danger-red);"></i>
            <span style="color:var(--danger-red);text-align:center;font-size:0.88rem;">
                ${resultado.erro}
            </span>
        `;
    }
}

// ================================================================
// ALUNOS — carrega do Supabase e preenche o <select>
// ================================================================
async function carregarAlunos() {
    const select = document.getElementById('selectAluno');

    const { data: alunos, error } = await supabaseClient
        .from('alunos')
        .select('ra, nome_aluno, telefone, status')
        .order('nome_aluno');

    if (error || !alunos) return;

    alunos.forEach(aluno => {
        const opt = document.createElement('option');
        opt.value            = aluno.ra;
        opt.dataset.nome     = aluno.nome_aluno;
        opt.dataset.telefone = aluno.telefone || '';
        opt.textContent      = aluno.telefone
            ? `${aluno.nome_aluno}  (RA: ${aluno.ra})`
            : `${aluno.nome_aluno}  (RA: ${aluno.ra}) ⚠️ sem telefone`;
        select.appendChild(opt);
    });

    select.addEventListener('change', aoSelecionarAluno);
}

// ================================================================
// SELEÇÃO DE ALUNO — exibe telefone e busca empréstimos ativos
// ================================================================
async function aoSelecionarAluno() {
    const select  = document.getElementById('selectAluno');
    const preview = document.getElementById('numeroAlunoPreview');
    const option  = select.options[select.selectedIndex];

    if (!option.value) {
        preview.style.display = 'none';
        emprestimosAluno = [];
        return;
    }

    if (!option.dataset.telefone) {
        preview.textContent   = '⚠️ Este aluno não tem telefone cadastrado. Cadastre o celular na tela de Alunos.';
        preview.style.background = '#fff5f5';
        preview.style.color = '#c53030';
        preview.style.border = '1px solid #fed7d7';
    } else {
        preview.textContent   = `📱 ${option.dataset.telefone}`;
        preview.style.background = '';
        preview.style.color = '';
        preview.style.border = '';
    }
    preview.style.display = 'inline-block';

    // Busca empréstimos ativos para pré-preencher os campos do template
    const { data } = await supabaseClient
        .from('emprestimos')
        .select('id, status, data_prevista, exemplares(livros(titulo))')
        .eq('aluno_ra', option.value)
        .in('status', ['Ativo', 'Atrasado'])
        .order('created_at', { ascending: false });

    emprestimosAluno = data || [];

    atualizarCamposTemplate();
    atualizarPreview();
}

// ================================================================
// TEMPLATES — renderiza os cards de seleção
// ================================================================
function renderizarTemplates() {
    const grid = document.getElementById('templateGrid');
    grid.innerHTML = '';

    TEMPLATES.forEach(t => {
        const card = document.createElement('div');
        card.className   = 'template-card';
        card.dataset.id  = t.id;
        card.innerHTML   = `
            <span class="template-emoji">${t.emoji}</span>
            <div class="template-texto">
                <strong>${t.titulo}</strong>
                <p>${t.descricao}</p>
            </div>
        `;
        card.addEventListener('click', () => selecionarTemplate(t.id));
        grid.appendChild(card);
    });
}

function selecionarTemplate(id) {
    templateSelecionado = id;

    document.querySelectorAll('.template-card').forEach(c => {
        c.classList.toggle('selecionado', c.dataset.id === id);
    });

    atualizarCamposTemplate();
    atualizarPreview();
}

// ================================================================
// CAMPOS DINÂMICOS — campos extras exibidos conforme o template
// ================================================================
function atualizarCamposTemplate() {
    // Remove campos extras anteriores
    document.querySelectorAll('.campo-dinamico').forEach(el => el.remove());

    const mensagemCustom = document.getElementById('grupoMensagemCustom');
    mensagemCustom.style.display = 'none';

    if (!templateSelecionado) return;

    if (templateSelecionado === 'personalizada') {
        mensagemCustom.style.display = 'block';
        return;
    }

    const template  = TEMPLATES.find(t => t.id === templateSelecionado);
    const previewEl = document.getElementById('previewMensagem');

    // Tenta pré-preencher com dados do empréstimo ativo
    const empAtivo    = emprestimosAluno[0];
    const tituloAuto  = empAtivo?.exemplares?.livros?.titulo || '';
    const dataAuto    = empAtivo ? formatarData(empAtivo.data_prevista) : '';
    const diasAuto    = (empAtivo?.status === 'Atrasado' && empAtivo?.data_prevista)
                          ? calcularDiasAtraso(empAtivo.data_prevista)
                          : '';

    let innerHtml = '';

    if (template.campos.includes('titulo_livro')) {
        innerHtml += `
            <div class="form-group" style="margin-bottom:14px;">
                <h5>Título do Livro</h5>
                <input type="text" id="campo_titulo"
                       placeholder="Ex: Dom Casmurro"
                       value="${tituloAuto}"
                       oninput="atualizarPreview()"
                       style="background:#fafafa;border:1.5px solid var(--border-color);border-radius:10px;padding:11px 14px;font-size:0.95rem;outline:none;width:100%;">
            </div>`;
    }
    if (template.campos.includes('data_devolucao')) {
        innerHtml += `
            <div class="form-group" style="margin-bottom:14px;">
                <h5>Data de Devolução</h5>
                <input type="text" id="campo_data"
                       placeholder="Ex: 15/06/2025"
                       value="${dataAuto}"
                       oninput="atualizarPreview()"
                       style="background:#fafafa;border:1.5px solid var(--border-color);border-radius:10px;padding:11px 14px;font-size:0.95rem;outline:none;width:100%;">
            </div>`;
    }
    if (template.campos.includes('dias_atraso')) {
        innerHtml += `
            <div class="form-group">
                <h5>Dias em Atraso</h5>
                <input type="number" id="campo_dias"
                       placeholder="Ex: 3" min="1"
                       value="${diasAuto}"
                       oninput="atualizarPreview()"
                       style="background:#fafafa;border:1.5px solid var(--border-color);border-radius:10px;padding:11px 14px;font-size:0.95rem;outline:none;width:100%;">
            </div>`;
    }

    if (!innerHtml) return;

    const container = document.createElement('div');
    container.className = 'campo-dinamico';
    container.style.marginBottom = '24px';
    container.innerHTML = `<h5 style="font-family:'Raleway',sans-serif;font-size:0.83rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px;">3. Dados da Mensagem</h5>` + innerHtml;

    previewEl.insertAdjacentElement('beforebegin', container);
}

// ================================================================
// PRÉVIA DA MENSAGEM — simula como o aluno vai receber
// ================================================================
function atualizarPreview() {
    const previewEl = document.getElementById('previewMensagem');
    const corpoEl   = document.getElementById('previewCorpo');

    if (!templateSelecionado) { previewEl.style.display = 'none'; return; }

    const select    = document.getElementById('selectAluno');
    const option    = select.options[select.selectedIndex];
    const nomeAluno = option?.dataset?.nome || 'Aluno';

    let texto = '';

    switch (templateSelecionado) {
        case 'confirmacao_emprestimo': {
            const titulo = document.getElementById('campo_titulo')?.value || '___';
            const data   = document.getElementById('campo_data')?.value   || '___';
            texto =
                `Olá, *${nomeAluno}*! 📚\n\n` +
                `Seu empréstimo foi registrado com sucesso na *Biblioteca Jorge Amado*.\n\n` +
                `📖 Livro: *${titulo}*\n` +
                `📅 Devolução prevista: *${data}*\n\n` +
                `Qualquer dúvida, procure a biblioteca. Boa leitura! 😊`;
            break;
        }
        case 'lembrete_devolucao': {
            const titulo = document.getElementById('campo_titulo')?.value || '___';
            const data   = document.getElementById('campo_data')?.value   || '___';
            texto =
                `Olá, *${nomeAluno}*! ⏰\n\n` +
                `Lembrete da *Biblioteca Jorge Amado*:\n\n` +
                `O livro *"${titulo}"* deve ser devolvido amanhã, *${data}*.\n\n` +
                `Contamos com você! 📚`;
            break;
        }
        case 'aviso_atraso': {
            const titulo = document.getElementById('campo_titulo')?.value || '___';
            const dias   = document.getElementById('campo_dias')?.value   || '___';
            texto =
                `Olá, *${nomeAluno}*! ⚠️\n\n` +
                `Aviso da *Biblioteca Jorge Amado*:\n\n` +
                `O livro *"${titulo}"* está em atraso há *${dias} dia(s)*.\n\n` +
                `Por favor, devolva o quanto antes para evitar bloqueio do seu cadastro.`;
            break;
        }
        case 'confirmacao_devolucao': {
            const titulo = document.getElementById('campo_titulo')?.value || '___';
            texto =
                `Olá, *${nomeAluno}*! ✅\n\n` +
                `A devolução do livro *"${titulo}"* foi confirmada na *Biblioteca Jorge Amado*.\n\n` +
                `Obrigado! Esperamos te ver em breve. 📚`;
            break;
        }
        case 'personalizada': {
            texto = document.getElementById('mensagemCustom')?.value || '';
            break;
        }
    }

    if (texto) {
        corpoEl.textContent     = texto;
        previewEl.style.display = 'block';
    } else {
        previewEl.style.display = 'none';
    }
}

// ================================================================
// MONTAR TEXTO DA MENSAGEM
// ================================================================
function montarTextoMensagem(nomeAluno) {
    switch (templateSelecionado) {
        case 'confirmacao_emprestimo': {
            const titulo = document.getElementById('campo_titulo')?.value || '';
            const data   = document.getElementById('campo_data')?.value   || '';
            if (!titulo || !data) return null;
            return (
                `Olá, *${nomeAluno}*! 📚\n\n` +
                `Seu empréstimo foi registrado com sucesso na *Biblioteca Jorge Amado*.\n\n` +
                `📖 Livro: *${titulo}*\n` +
                `📅 Devolução prevista: *${data}*\n\n` +
                `Qualquer dúvida, procure a biblioteca. Boa leitura! 😊`
            );
        }
        case 'lembrete_devolucao': {
            const titulo = document.getElementById('campo_titulo')?.value || '';
            const data   = document.getElementById('campo_data')?.value   || '';
            if (!titulo || !data) return null;
            return (
                `Olá, *${nomeAluno}*! ⏰\n\n` +
                `Lembrete da *Biblioteca Jorge Amado*:\n\n` +
                `O livro *"${titulo}"* deve ser devolvido amanhã, *${data}*.\n\n` +
                `Contamos com você! 📚`
            );
        }
        case 'aviso_atraso': {
            const titulo = document.getElementById('campo_titulo')?.value || '';
            const dias   = document.getElementById('campo_dias')?.value   || '';
            if (!titulo || !dias) return null;
            return (
                `Olá, *${nomeAluno}*! ⚠️\n\n` +
                `Aviso da *Biblioteca Jorge Amado*:\n\n` +
                `O livro *"${titulo}"* está em atraso há *${dias} dia(s)*.\n\n` +
                `Por favor, devolva o quanto antes para evitar bloqueio do seu cadastro.`
            );
        }
        case 'confirmacao_devolucao': {
            const titulo = document.getElementById('campo_titulo')?.value || '';
            if (!titulo) return null;
            return (
                `Olá, *${nomeAluno}*! ✅\n\n` +
                `A devolução do livro *"${titulo}"* foi confirmada na *Biblioteca Jorge Amado*.\n\n` +
                `Obrigado! Esperamos te ver em breve. 📚`
            );
        }
        case 'personalizada':
            return document.getElementById('mensagemCustom')?.value.trim() || null;
        default:
            return null;
    }
}

// ================================================================
// ENVIAR MENSAGEM
// ================================================================
async function handleEnviarMensagem(e) {
    e.preventDefault();

    const select  = document.getElementById('selectAluno');
    const option  = select.options[select.selectedIndex];
    const btnEnv  = document.getElementById('btnEnviar');

    if (!option.value) {
        mostrarToast('Selecione um aluno.', 'erro');
        return;
    }
    if (!option.dataset.telefone) {
        mostrarToast('Este aluno não tem telefone cadastrado. Adicione o celular na tela de Alunos.', 'erro');
        return;
    }
    if (!templateSelecionado) {
        mostrarToast('Selecione um tipo de mensagem.', 'erro');
        return;
    }

    const nomeAluno = option.dataset.nome;
    const telefone  = option.dataset.telefone;
    const mensagem  = montarTextoMensagem(nomeAluno);

    if (!mensagem) {
        mostrarToast('Preencha todos os dados da mensagem.', 'erro');
        return;
    }

    btnEnv.disabled  = true;
    btnEnv.innerHTML = '<i class="bi bi-hourglass-split spinning"></i> Enviando...';

    try {
        const resposta = await fetch('http://localhost:3000/enviar-notificacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telefone, mensagem, nomeAluno, tipo: templateSelecionado })
        });

        const dados = await resposta.json().catch(() => ({}));

        if (resposta.ok && dados.sucesso !== false) {
            mostrarToast(`Mensagem enviada para ${nomeAluno}! ✅`, 'sucesso');
            limparFormulario();
            const btnHistorico = document.querySelector('[data-tab="historico"]');
            if (btnHistorico) mudarAba(btnHistorico);
            carregarHistorico().catch(() => {});
        } else {
            const erroMsg = dados.erro || dados.message || 'Falha ao enviar';
            mostrarToast(`Erro: ${erroMsg}`, 'erro');
            carregarHistorico().catch(() => {});
        }
    } catch {
        mostrarToast('Servidor offline. Verifique se o servidor está rodando na porta 3000.', 'erro');
        carregarHistorico().catch(() => {});
    } finally {
        btnEnv.disabled  = false;
        btnEnv.innerHTML = '<i class="bi bi-whatsapp"></i> Enviar pelo WhatsApp';
    }
}

// ================================================================
// HISTÓRICO (buscado do servidor; localStorage como fallback offline)
// ================================================================
async function carregarHistorico() {
    const tbody  = document.getElementById('historicoTableBody');
    const semMsg = document.getElementById('semHistorico');

    tbody.innerHTML = '';

    const LABELS = {
        boas_vindas:            '👋 Boas-Vindas',
        confirmacao_emprestimo: '📚 Confirmação de Empréstimo',
        lembrete_devolucao:     '⏰ Lembrete de Devolução',
        aviso_atraso:           '⚠️ Aviso de Atraso',
        confirmacao_devolucao:  '✅ Confirmação de Devolução',
        personalizada:          '💬 Personalizada',
        automatica:             '🤖 Automática'
    };

    let historico = [];

    try {
        const resp = await fetch('http://localhost:3000/api/historico');
        if (resp.ok) historico = await resp.json();
    } catch {
        // servidor offline: usa localStorage como fallback
        historico = JSON.parse(localStorage.getItem('chatbot_historico') || '[]');
    }

    if (!historico.length) {
        semMsg.style.display = 'block';
        return;
    }
    semMsg.style.display = 'none';

    historico.forEach(entry => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${entry.nomeAluno}</td>
            <td>${entry.numero}</td>
            <td><span class="badge-tipo">${LABELS[entry.tipo] || entry.tipo}</span></td>
            <td>${new Date(entry.data).toLocaleString('pt-BR')}</td>
            <td>
                <span class="badge-status-msg ${entry.status}">
                    ${entry.status === 'enviado' ? 'Enviado' : 'Erro'}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ================================================================
// ABAS (Enviar / Histórico)
// ================================================================
function mudarAba(btn) {
    document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tabId = btn.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const aba = document.getElementById(`aba-${tabId}`);
    if (aba) aba.style.display = 'block';

    if (tabId === 'historico') carregarHistorico().catch(() => {});
}

// ================================================================
// MODAL DE CONFIGURAÇÕES (informativo — mostra como iniciar server)
// ================================================================
async function abrirConfiguracoes() {
    document.getElementById('modalConfiguracoes').style.display = 'flex';
    await testarConexaoServidor();
}

function fecharConfiguracoes() {
    document.getElementById('modalConfiguracoes').style.display = 'none';
}

async function testarConexaoServidor() {
    const el = document.getElementById('statusServidorModal');
    if (!el) return;

    el.textContent  = '⏳ Testando conexão com o servidor...';
    el.style.background = '#fefce8';
    el.style.color = '#854d0e';

    const resultado = await ChatbotAPI.verificarConexao();

    if (resultado.estado === 'erro') {
        el.textContent  = '❌ Servidor offline — abra o iniciar.bat';
        el.style.background = '#fff5f5';
        el.style.color = '#c53030';
    } else if (resultado.conectado) {
        el.textContent  = '✅ Servidor online — WhatsApp conectado!';
        el.style.background = '#e8f8ef';
        el.style.color = '#128C7E';
    } else {
        el.textContent  = '🟡 Servidor online — aguardando QR Code';
        el.style.background = '#fefce8';
        el.style.color = '#854d0e';
    }
}

// ================================================================
// LIMPAR FORMULÁRIO
// ================================================================
function limparFormulario() {
    document.getElementById('selectAluno').value          = '';
    document.getElementById('numeroAlunoPreview').style.display = 'none';
    document.getElementById('previewMensagem').style.display    = 'none';
    document.getElementById('grupoMensagemCustom').style.display = 'none';
    document.getElementById('mensagemCustom').value       = '';
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selecionado'));
    document.querySelectorAll('.campo-dinamico').forEach(el => el.remove());
    templateSelecionado  = null;
    emprestimosAluno     = [];
}

// ================================================================
// TOAST — notificações flutuantes
// ================================================================
function mostrarToast(mensagem, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    const toast     = document.createElement('div');
    const ehSucesso = tipo === 'sucesso';
    toast.className = `toast ${ehSucesso ? 'sucesso' : 'erro'}`;
    toast.innerHTML = `
        <i class="bi bi-${ehSucesso ? 'check-circle-fill' : 'exclamation-circle-fill'} toast-icon"></i>
        ${mensagem}
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
}

// ================================================================
// SIDEBAR
// ================================================================
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

// ================================================================
// UTILITÁRIOS
// ================================================================
function formatarData(dateStr) {
    if (!dateStr) return '';
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
}

function calcularDiasAtraso(dataPrevista) {
    const hoje = new Date();
    const data  = new Date(dataPrevista);
    const diff  = Math.floor((hoje - data) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
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
