/**
 * chatbot.js
 * ================================================================
 * O QUE ESTE ARQUIVO FAZ:
 *   Controla tudo o que aparece na tela de mensagens.
 *   Ele usa o conexao-api.js para realmente enviar as mensagens,
 *   e o Supabase para:
 *     → Carregar a lista de alunos no seletor
 *     → Salvar e exibir o histórico de mensagens enviadas
 *
 * TABELA NECESSÁRIA NO SUPABASE:
 *   Você precisa criar a tabela "historico_mensagens" no Supabase.
 *   Para criar, vá em SQL Editor e execute:
 *
 *   CREATE TABLE historico_mensagens (
 *     id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     nome_aluno TEXT,
 *     numero     TEXT,
 *     tipo       TEXT,
 *     status     TEXT DEFAULT 'enviado',
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *
 *   Depois vá em Authentication > Policies e habilite acesso público
 *   para essa tabela (igual você fez nas outras tabelas).
 * ================================================================
 */


// ---------------------------------------------------------------
// CONEXÃO COM O SUPABASE
// Substitua pelos mesmos valores que você usa nos outros arquivos
// ---------------------------------------------------------------
const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z3R3ZGNkanRic2xjYXZlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQxNTgsImV4cCI6MjA5MDY1MDE1OH0.TlvsoZkzLjKimaqvqMrekWLlWL7dvOfLtimJOTr8htU';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// ---------------------------------------------------------------
// TEMPLATES DE MENSAGEM
//
// Cada item desta lista representa um botão de template na tela.
// O campo "gerarTexto" é uma função que monta a mensagem final
// com os dados do aluno (nome, livro, etc.) inseridos.
// ---------------------------------------------------------------
const TEMPLATES = [
    {
        id: 'emprestimo',
        emoji: '📚',
        nome: 'Confirmação de Empréstimo',
        descricao: 'Avisa que o empréstimo foi registrado com sucesso.',
        gerarTexto: (nome, extra = {}) =>
            `Olá, *${nome}*! 📚\n\n` +
            `Seu empréstimo foi registrado com sucesso na *Biblioteca Jorge Amado*.\n\n` +
            `📖 Livro: *${extra.livro || '—'}*\n` +
            `📅 Devolução prevista: *${extra.data || '—'}*\n\n` +
            `Qualquer dúvida, procure a biblioteca. Boa leitura! 😊`
    },
    {
        id: 'lembrete',
        emoji: '⏰',
        nome: 'Lembrete de Devolução',
        descricao: 'Lembra o aluno que o prazo vence amanhã.',
        gerarTexto: (nome, extra = {}) =>
            `Olá, *${nome}*! ⏰\n\n` +
            `Lembrete da *Biblioteca Jorge Amado*:\n\n` +
            `O livro *"${extra.livro || '—'}"* deve ser devolvido amanhã, *${extra.data || '—'}*.\n\n` +
            `Contamos com você! 📚`
    },
    {
        id: 'atraso',
        emoji: '⚠️',
        nome: 'Aviso de Atraso',
        descricao: 'Notifica quando o prazo já passou.',
        gerarTexto: (nome, extra = {}) =>
            `Olá, *${nome}*! ⚠️\n\n` +
            `Aviso da *Biblioteca Jorge Amado*:\n\n` +
            `O livro *"${extra.livro || '—'}"* está em atraso há *${extra.diasAtraso || '?'} dia(s)*.\n\n` +
            `Por favor, devolva o quanto antes para evitar bloqueio do seu cadastro.`
    },
    {
        id: 'devolucao',
        emoji: '✅',
        nome: 'Confirmação de Devolução',
        descricao: 'Confirma que o livro foi devolvido.',
        gerarTexto: (nome, extra = {}) =>
            `Olá, *${nome}*! ✅\n\n` +
            `A devolução do livro *"${extra.livro || '—'}"* foi confirmada na *Biblioteca Jorge Amado*.\n\n` +
            `Obrigado! Esperamos te ver em breve. 📚`
    },
    {
        id: 'personalizada',
        emoji: '✏️',
        nome: 'Mensagem Personalizada',
        descricao: 'Escreva uma mensagem do zero para o aluno.',
        gerarTexto: (nome, extra = {}) => extra.mensagemCustom || ''
    }
];

// Guarda o template que o usuário selecionou na tela
let templateSelecionado = null;


// ---------------------------------------------------------------
// INICIALIZAÇÃO DA PÁGINA
//
// Este bloco roda automaticamente quando a página termina de
// carregar (evento DOMContentLoaded).
// A ordem importa: primeiro monta a tela, depois busca os dados.
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    renderizarTemplates();           // Cria os cards de template no HTML
    await carregarAlunos();          // Busca alunos no Supabase e preenche o seletor
    await verificarStatusConexao();  // Mostra se o WhatsApp está conectado

    // Verifica a conexão a cada 30 segundos automaticamente
    // (para detectar se o usuário conectou ou desconectou o WhatsApp)
    setInterval(verificarStatusConexao, 30000);

    // Quando o usuário escolhe um aluno, atualiza o número exibido
    document.getElementById('selectAluno')
        .addEventListener('change', onAlunoChange);

    // Quando o usuário digita na mensagem personalizada, atualiza a prévia
    document.getElementById('mensagemCustom')
        .addEventListener('input', atualizarPreview);

    // Vincula o formulário à função de envio
    document.getElementById('formEnviarMensagem')
        .addEventListener('submit', enviarMensagemHandler);
});


// ---------------------------------------------------------------
// RENDERIZAR CARDS DE TEMPLATE
//
// Cria dinamicamente os cards de seleção de tipo de mensagem.
// Cada card vira um botão clicável na tela.
// ---------------------------------------------------------------
function renderizarTemplates() {
    const grid = document.getElementById('templateGrid');

    grid.innerHTML = TEMPLATES.map(t => `
        <div class="template-card" data-id="${t.id}" onclick="selecionarTemplate('${t.id}')">
            <span class="template-emoji">${t.emoji}</span>
            <div class="template-texto">
                <strong>${t.nome}</strong>
                <p>${t.descricao}</p>
            </div>
        </div>
    `).join('');
}


// ---------------------------------------------------------------
// SELECIONAR TEMPLATE
//
// Quando o usuário clica num card de template:
//   1. Marca o card como selecionado (muda a cor)
//   2. Mostra ou esconde o campo de texto livre
//   3. Atualiza a prévia da mensagem
// ---------------------------------------------------------------
function selecionarTemplate(id) {
    templateSelecionado = TEMPLATES.find(t => t.id === id);

    // Remove a seleção de todos e aplica no clicado
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selecionado'));
    document.querySelector(`.template-card[data-id="${id}"]`).classList.add('selecionado');

    // O campo de texto livre só aparece no template "personalizada"
    const grupoCustom = document.getElementById('grupoMensagemCustom');
    grupoCustom.style.display = id === 'personalizada' ? 'flex' : 'none';

    atualizarPreview();
}


// ---------------------------------------------------------------
// ATUALIZAR PRÉVIA DA MENSAGEM
//
// Mostra como a mensagem vai ficar antes de enviar.
// Usa o nome do aluno selecionado e o template escolhido.
// ---------------------------------------------------------------
function atualizarPreview() {
    if (!templateSelecionado) return;

    const select = document.getElementById('selectAluno');
    const nomeAluno = select.options[select.selectedIndex]?.text || 'Aluno';
    const mensagemCustom = document.getElementById('mensagemCustom').value;

    const texto = templateSelecionado.gerarTexto(nomeAluno, { mensagemCustom });

    const previewDiv  = document.getElementById('previewMensagem');
    const previewCorpo = document.getElementById('previewCorpo');

    if (texto) {
        // Converte o *negrito* do WhatsApp em <strong> para a prévia
        const textoFormatado = texto
            .replace(/\*(.*?)\*/g, '<strong>$1</strong>') // *texto* → negrito
            .replace(/\n/g, '<br>');                       // quebras de linha

        previewCorpo.innerHTML = textoFormatado;
        previewDiv.style.display = 'block';
    } else {
        previewDiv.style.display = 'none';
    }
}


// ---------------------------------------------------------------
// QUANDO O ALUNO MUDA
//
// Atualiza o número de telefone exibido abaixo do seletor
// e refaz a prévia com o novo nome.
// ---------------------------------------------------------------
function onAlunoChange() {
    const select  = document.getElementById('selectAluno');
    const option  = select.options[select.selectedIndex];
    const preview = document.getElementById('numeroAlunoPreview');

    if (option?.value && option.dataset.telefone) {
        preview.textContent = `📱 ${option.dataset.telefone}`;
        preview.style.display = 'inline-block';
    } else {
        preview.style.display = 'none';
    }

    atualizarPreview();
}


// ---------------------------------------------------------------
// CARREGAR ALUNOS DO SUPABASE
//
// Busca todos os alunos cadastrados e preenche o <select>.
// Cada <option> guarda o telefone no atributo data-telefone,
// que é lido depois na hora de enviar a mensagem.
// ---------------------------------------------------------------
async function carregarAlunos() {
    const select = document.getElementById('selectAluno');

    const { data, error } = await supabase
        .from('alunos')
        .select('id, nome_aluno, telefone')
        .order('nome_aluno', { ascending: true });

    if (error || !data?.length) {
        console.warn('Nenhum aluno carregado:', error?.message);
        return;
    }

    data.forEach(aluno => {
        const opt = document.createElement('option');
        opt.value = aluno.id;
        opt.textContent = aluno.nome_aluno;
        opt.dataset.telefone = aluno.telefone || '';
        select.appendChild(opt);
    });
}


// ---------------------------------------------------------------
// VERIFICAR STATUS DA CONEXÃO
//
// Atualiza o badge colorido no cabeçalho da página:
//   🟢 Verde   → WhatsApp conectado
//   🔴 Vermelho → Desconectado (mostra a área do QR Code)
//   🟡 Amarelo → Verificando / erro de configuração
// ---------------------------------------------------------------
async function verificarStatusConexao() {
    const badge = document.getElementById('statusConexao');
    const texto = document.getElementById('statusTexto');

    badge.className = 'status-badge-whatsapp status-verificando';
    texto.textContent = 'Verificando...';

    const status = await ChatbotAPI.verificarConexao();

    if (status.conectado) {
        badge.className = 'status-badge-whatsapp status-conectado';
        texto.textContent = '● WhatsApp Conectado';
        document.getElementById('areaQRCode').style.display = 'none';

    } else if (status.estado === 'erro') {
        badge.className = 'status-badge-whatsapp status-erro';
        texto.textContent = '● API não configurada';
        document.getElementById('areaQRCode').style.display = 'none';

    } else {
        badge.className = 'status-badge-whatsapp status-desconectado';
        texto.textContent = '● Desconectado';
        document.getElementById('areaQRCode').style.display = 'block';
        carregarQRCode();
    }
}


// ---------------------------------------------------------------
// CARREGAR QR CODE
//
// Busca o QR Code na Evolution API e exibe como imagem.
// O usuário escaneia com o WhatsApp para conectar o número.
// ---------------------------------------------------------------
async function carregarQRCode() {
    const container = document.getElementById('qrCodeImg');

    // Mostra estado de carregamento
    container.innerHTML = `
        <i class="bi bi-arrow-repeat spinning"></i>
        <span>Carregando QR Code...</span>
    `;

    const resultado = await ChatbotAPI.obterQRCode();

    if (resultado.sucesso && resultado.qrCode) {
        // A API retorna uma string Base64; colocamos direto no src da imagem
        container.innerHTML = `
            <img src="${resultado.qrCode}" alt="QR Code para conectar WhatsApp">
        `;
    } else {
        container.innerHTML = `
            <i class="bi bi-x-circle" style="font-size:2rem; color:#e53e3e;"></i>
            <span style="color:#e53e3e;">${resultado.erro}</span>
        `;
    }
}


// ---------------------------------------------------------------
// HANDLER DE ENVIO DO FORMULÁRIO
//
// Executado quando o usuário clica em "Enviar pelo WhatsApp".
// Valida os campos, envia a mensagem e salva no histórico.
// ---------------------------------------------------------------
async function enviarMensagemHandler(e) {
    e.preventDefault(); // Impede o formulário de recarregar a página

    const select  = document.getElementById('selectAluno');
    const option  = select.options[select.selectedIndex];

    // Validações antes de enviar
    if (!option?.value) {
        mostrarToast('Selecione um aluno.', 'erro');
        return;
    }

    if (!templateSelecionado) {
        mostrarToast('Selecione um tipo de mensagem.', 'erro');
        return;
    }

    const telefone = option.dataset.telefone;
    if (!telefone) {
        mostrarToast('Este aluno não tem número de telefone cadastrado.', 'erro');
        return;
    }

    const nomeAluno     = option.text;
    const mensagemCustom = document.getElementById('mensagemCustom').value;
    const textoFinal    = templateSelecionado.gerarTexto(nomeAluno, { mensagemCustom });

    if (!textoFinal) {
        mostrarToast('A mensagem não pode ser vazia.', 'erro');
        return;
    }

    // Desativa o botão e mostra "Enviando..."
    const btnEnviar = document.getElementById('btnEnviar');
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<i class="bi bi-arrow-repeat spinning"></i> Enviando...';

    const resultado = await ChatbotAPI.enviarMensagem(telefone, textoFinal);

    if (resultado.sucesso) {
        mostrarToast(`✅ Mensagem enviada para ${nomeAluno}!`, 'sucesso');
        await registrarNoHistorico(nomeAluno, telefone, templateSelecionado.nome, 'enviado');
        limparFormulario();
    } else {
        mostrarToast(`❌ Erro: ${resultado.erro}`, 'erro');
        await registrarNoHistorico(nomeAluno, telefone, templateSelecionado.nome, 'erro');
    }

    // Reativa o botão
    btnEnviar.disabled = false;
    btnEnviar.innerHTML = '<i class="bi bi-whatsapp"></i> Enviar pelo WhatsApp';
}


// ---------------------------------------------------------------
// REGISTRAR NO HISTÓRICO (Supabase)
//
// Salva um registro de cada mensagem enviada (ou que deu erro).
// Isso permite consultar depois quem recebeu e quando.
// ---------------------------------------------------------------
async function registrarNoHistorico(nomeAluno, numero, tipo, status) {
    const { error } = await supabase
        .from('historico_mensagens')
        .insert([{ nome_aluno: nomeAluno, numero, tipo, status }]);

    if (error) {
        console.warn('Não foi possível salvar no histórico:', error.message);
    }
}


// ---------------------------------------------------------------
// CARREGAR HISTÓRICO (Supabase)
//
// Busca as últimas 50 mensagens enviadas e monta a tabela.
// Chamado quando o usuário troca para a aba "Histórico".
// ---------------------------------------------------------------
async function carregarHistorico() {
    const tbody      = document.getElementById('historicoTableBody');
    const semDados   = document.getElementById('semHistorico');

    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Carregando...</td></tr>';

    const { data, error } = await supabase
        .from('historico_mensagens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error || !data?.length) {
        tbody.innerHTML = '';
        semDados.style.display = 'block';
        return;
    }

    semDados.style.display = 'none';

    tbody.innerHTML = data.map(msg => `
        <tr>
            <td>${msg.nome_aluno || '—'}</td>
            <td>${msg.numero || '—'}</td>
            <td><span class="badge-tipo">${msg.tipo || '—'}</span></td>
            <td>${new Date(msg.created_at).toLocaleString('pt-BR')}</td>
            <td>
                <span class="badge-status-msg ${msg.status}">
                    ${msg.status === 'enviado' ? '✅ Enviado' : '❌ Erro'}
                </span>
            </td>
        </tr>
    `).join('');
}


// ---------------------------------------------------------------
// TROCAR ABA (Enviar / Histórico)
//
// Mostra o conteúdo da aba clicada e esconde o das outras.
// ---------------------------------------------------------------
function mudarAba(btn) {
    const tabId = btn.dataset.tab;

    // Atualiza o estilo dos botões de aba
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    // Mostra o painel da aba correta
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`aba-${tabId}`).style.display = 'block';

    // Se abriu o histórico, carrega os dados
    if (tabId === 'historico') carregarHistorico();
}


// ---------------------------------------------------------------
// MODAL DE CONFIGURAÇÕES
//
// Abre e fecha o modal onde o usuário preenche os dados da API.
// As configurações são salvas no localStorage pelo conexao-api.js.
// ---------------------------------------------------------------
function abrirConfiguracoes() {
    const config = ChatbotAPI.carregarConfigAPI();
    document.getElementById('configBaseUrl').value  = config.baseUrl  || '';
    document.getElementById('configInstancia').value = config.instancia || '';
    document.getElementById('configApiKey').value   = config.apiKey   || '';
    document.getElementById('modalConfiguracoes').style.display = 'flex';
}

function fecharConfiguracoes() {
    document.getElementById('modalConfiguracoes').style.display = 'none';
}

async function salvarConfiguracoes() {
    const baseUrl   = document.getElementById('configBaseUrl').value.trim();
    const instancia = document.getElementById('configInstancia').value.trim();
    const apiKey    = document.getElementById('configApiKey').value.trim();

    if (!baseUrl || !instancia || !apiKey) {
        mostrarToast('Preencha todos os campos antes de salvar.', 'erro');
        return;
    }

    ChatbotAPI.salvarConfigAPI(baseUrl, instancia, apiKey);
    fecharConfiguracoes();
    mostrarToast('Configurações salvas! Verificando conexão...', 'sucesso');
    await verificarStatusConexao();
}

// Alterna entre mostrar/esconder a chave de API (campo de senha)
function alternarVisibilidadeSenha() {
    const input  = document.getElementById('configApiKey');
    const icone  = document.getElementById('iconeOlho');
    const escondido = input.type === 'password';
    input.type   = escondido ? 'text' : 'password';
    icone.className = escondido ? 'bi bi-eye-slash' : 'bi bi-eye';
}


// ---------------------------------------------------------------
// LIMPAR FORMULÁRIO
//
// Reseta todos os campos após enviar uma mensagem.
// ---------------------------------------------------------------
function limparFormulario() {
    document.getElementById('selectAluno').value = '';
    document.getElementById('numeroAlunoPreview').style.display = 'none';
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selecionado'));
    document.getElementById('grupoMensagemCustom').style.display = 'none';
    document.getElementById('mensagemCustom').value = '';
    document.getElementById('previewMensagem').style.display = 'none';
    templateSelecionado = null;
}


// ---------------------------------------------------------------
// TOAST — Notificação flutuante
//
// Exibe uma mensagem pequena no canto da tela por 4 segundos.
// tipo: 'sucesso' (verde) ou 'erro' (vermelho)
// ---------------------------------------------------------------
function mostrarToast(msg, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `<span class="toast-icon">${tipo === 'sucesso' ? '✅' : '❌'}</span> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}


// ---------------------------------------------------------------
// SIDEBAR (minimizar/expandir)
// Mesmo comportamento das outras páginas do sistema.
// ---------------------------------------------------------------
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}
