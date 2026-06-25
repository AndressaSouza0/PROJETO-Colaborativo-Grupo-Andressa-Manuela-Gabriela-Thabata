/**
 * conexao-api.js
 * ================================================================
 * MODO: Servidor Local (Node.js + whatsapp-web.js)
 *
 * COMO FUNCIONA:
 *   Sistema da biblioteca (browser)
 *        ↓ chama http://localhost:3001
 *   Servidor Node.js (roda no seu computador)
 *        ↓ envia via
 *   WhatsApp
 *
 * PARA INICIAR O SERVIDOR:
 *   Abra a pasta "servidor-whatsapp" e dê duplo clique
 *   no arquivo "iniciar.bat". Deixe a janela aberta.
 *
 * Nota: as assinaturas das funções são mantidas iguais
 * para compatibilidade com emprestimo.js e outros arquivos.
 * ================================================================
 */

const LOCAL_SERVER = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? ''
    : 'http://127.0.0.1:3000';

// Mantido por compatibilidade — não é mais necessário configurar
function carregarConfigAPI() {
    return { baseUrl: LOCAL_SERVER, instancia: 'local', apiKey: '' };
}
function salvarConfigAPI() {}
function apiEstaConfigurada() { return true; }


// ---------------------------------------------------------------
// FUNÇÃO BASE — comunica com o servidor local
// ---------------------------------------------------------------
async function chamarAPI(endpoint, metodo = 'GET', corpo = null) {
    const url = `${LOCAL_SERVER}${endpoint}`;
    const opcoes = {
        method: metodo,
        headers: { 'Content-Type': 'application/json' }
    };
    if (corpo) opcoes.body = JSON.stringify(corpo);

    try {
        const resposta = await fetch(url, opcoes);
        const dados    = await resposta.json();
        return { sucesso: true, dados };
    } catch {
        return {
            sucesso: false,
            erro: 'Servidor offline. Abra "iniciar.bat" na pasta servidor-whatsapp e aguarde.'
        };
    }
}


// ---------------------------------------------------------------
// VERIFICAR STATUS DA CONEXÃO
// ---------------------------------------------------------------
async function verificarConexao() {
    const resultado = await chamarAPI('/api/status');

    if (!resultado.sucesso) {
        return { conectado: false, estado: 'erro', mensagem: resultado.erro };
    }

    return {
        conectado: resultado.dados.conectado,
        estado:    resultado.dados.estado,
        mensagem:  resultado.dados.mensagem
    };
}


// ---------------------------------------------------------------
// OBTER QR CODE
// ---------------------------------------------------------------
async function obterQRCode() {
    const resultado = await chamarAPI('/api/qrcode');

    if (!resultado.sucesso) {
        return { sucesso: false, erro: resultado.erro };
    }
    if (!resultado.dados.sucesso) {
        return { sucesso: false, erro: resultado.dados.erro };
    }

    return { sucesso: true, qrCode: resultado.dados.qrCode };
}


// ---------------------------------------------------------------
// FORMATAR NÚMERO DE TELEFONE
// ---------------------------------------------------------------
function formatarNumero(numero) {
    const digitos = String(numero).replace(/\D/g, '');
    if (digitos.length === 11) return `55${digitos}`;
    if (digitos.length === 10) return `55${digitos}`;
    if (digitos.length === 13) return digitos;
    if (digitos.length === 12) return digitos;
    return null;
}


// ---------------------------------------------------------------
// ENVIAR MENSAGEM DE TEXTO
// ---------------------------------------------------------------
async function enviarMensagem(numeroOriginal, texto, meta = {}) {
    const numero = formatarNumero(numeroOriginal);

    if (!numero) {
        return {
            sucesso: false,
            erro: `Número inválido: "${numeroOriginal}". Use o formato (11) 99999-9999.`
        };
    }

    const resultado = await chamarAPI('/api/send-message', 'POST', {
        number: numero,
        text:   texto,
        meta
    });

    if (!resultado.sucesso) return resultado;
    if (!resultado.dados.sucesso) return { sucesso: false, erro: resultado.dados.erro };
    return { sucesso: true };
}


// ---------------------------------------------------------------
// TEMPLATES DE MENSAGEM AUTOMÁTICA
// ---------------------------------------------------------------

async function enviarBoasVindas(nomeAluno, numero) {
    const texto =
        `Olá, *${nomeAluno}*! 👋\n\n` +
        `Seja bem-vindo(a) à *Biblioteca Jorge Amado*!\n\n` +
        `Ficamos felizes em ter você conosco. Aproveite os livros! 📚`;
    return await enviarMensagem(numero, texto, { nomeAluno, tipo: 'boas_vindas' });
}

async function enviarConfirmacaoEmprestimo(nomeAluno, numero, tituloLivro, dataDevolucao) {
    const texto =
        `Olá, *${nomeAluno}*! 📚\n\n` +
        `Seu empréstimo foi registrado com sucesso na *Biblioteca Jorge Amado*.\n\n` +
        `📖 Livro: *${tituloLivro}*\n` +
        `📅 Devolução prevista: *${dataDevolucao}*\n\n` +
        `Qualquer dúvida, procure a biblioteca. Boa leitura! 😊`;
    return await enviarMensagem(numero, texto, { nomeAluno, tipo: 'confirmacao_emprestimo' });
}

async function enviarLembreteDevolvucao(nomeAluno, numero, tituloLivro, dataDevolucao) {
    const texto =
        `Olá, *${nomeAluno}*! ⏰\n\n` +
        `Lembrete da *Biblioteca Jorge Amado*:\n\n` +
        `O livro *"${tituloLivro}"* deve ser devolvido amanhã, *${dataDevolucao}*.\n\n` +
        `Contamos com você! 📚`;
    return await enviarMensagem(numero, texto, { nomeAluno, tipo: 'lembrete_devolucao' });
}

async function enviarAvisoAtraso(nomeAluno, numero, tituloLivro, diasAtraso) {
    const texto =
        `Olá, *${nomeAluno}*! ⚠️\n\n` +
        `Aviso da *Biblioteca Jorge Amado*:\n\n` +
        `O livro *"${tituloLivro}"* está em atraso há *${diasAtraso} dia(s)*.\n\n` +
        `Por favor, devolva o quanto antes para evitar bloqueio do seu cadastro.`;
    return await enviarMensagem(numero, texto, { nomeAluno, tipo: 'aviso_atraso' });
}

async function enviarConfirmacaoDevolucao(nomeAluno, numero, tituloLivro) {
    const texto =
        `Olá, *${nomeAluno}*! ✅\n\n` +
        `A devolução do livro *"${tituloLivro}"* foi confirmada na *Biblioteca Jorge Amado*.\n\n` +
        `Obrigado! Esperamos te ver em breve. 📚`;
    return await enviarMensagem(numero, texto, { nomeAluno, tipo: 'confirmacao_devolucao' });
}


// ---------------------------------------------------------------
// EXPORTAR PARA USO GLOBAL
// ---------------------------------------------------------------
window.ChatbotAPI = {
    baseUrl: LOCAL_SERVER,
    carregarConfigAPI,
    salvarConfigAPI,
    apiEstaConfigurada,
    verificarConexao,
    obterQRCode,
    enviarMensagem,
    enviarBoasVindas,
    enviarConfirmacaoEmprestimo,
    enviarLembreteDevolvucao,
    enviarAvisoAtraso,
    enviarConfirmacaoDevolucao
};
