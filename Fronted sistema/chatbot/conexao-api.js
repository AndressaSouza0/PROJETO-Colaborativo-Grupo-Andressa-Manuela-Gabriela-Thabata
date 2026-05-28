/**
 * conexao-api.js
 * ================================================================
 * O QUE ESTE ARQUIVO FAZ:
 *   Este é o "intermediário" entre o sistema da biblioteca e o
 *   WhatsApp. Ele usa a Evolution API — uma ferramenta gratuita
 *   e de código aberto muito popular no Brasil.
 *
 * COMO FUNCIONA O FLUXO:
 *   Seu sistema  →  Evolution API (servidor)  →  WhatsApp
 *
 * ONDE HOSPEDAR A EVOLUTION API DE GRAÇA:
 *   Railway.app (https://railway.app) — hospedagem gratuita.
 *   Você cria uma conta, faz o deploy da Evolution API e pronto.
 *   O próprio site da Evolution API tem um guia de como fazer isso.
 *   Site oficial: https://evolution-api.com
 *
 * IMPORTANTE:
 *   Este arquivo é carregado ANTES do chatbot.js.
 *   Outros arquivos do sistema (como emprestimo.js) também podem
 *   usar este arquivo para enviar mensagens automáticas.
 * ================================================================
 */


// ---------------------------------------------------------------
// GERENCIAMENTO DE CONFIGURAÇÃO
//
// As configurações ficam salvas no localStorage do navegador.
// Isso significa que o usuário preenche apenas uma vez, e o
// sistema lembra das informações mesmo ao fechar o navegador.
// ---------------------------------------------------------------

/**
 * Carrega as configurações salvas pelo usuário.
 * Retorna um objeto com: baseUrl, instancia e apiKey.
 */
function carregarConfigAPI() {
    return {
        baseUrl:   localStorage.getItem('evo_baseUrl')   || '',
        instancia: localStorage.getItem('evo_instancia') || '',
        apiKey:    localStorage.getItem('evo_apiKey')    || ''
    };
}

/**
 * Salva as configurações no localStorage.
 * Remove a barra final da URL se houver (ex: "minha-api.com/" → "minha-api.com")
 */
function salvarConfigAPI(baseUrl, instancia, apiKey) {
    localStorage.setItem('evo_baseUrl',   baseUrl.trim().replace(/\/$/, ''));
    localStorage.setItem('evo_instancia', instancia.trim());
    localStorage.setItem('evo_apiKey',    apiKey.trim());
}

/**
 * Verifica se a API já foi configurada pelo usuário.
 * Retorna true se todos os campos estiverem preenchidos.
 */
function apiEstaConfigurada() {
    const config = carregarConfigAPI();
    return !!(config.baseUrl && config.instancia && config.apiKey);
}


// ---------------------------------------------------------------
// FUNÇÃO BASE DE COMUNICAÇÃO COM A API
//
// Toda vez que o sistema precisar "falar" com a Evolution API,
// passa por aqui. Isso evita repetir código de fetch em toda parte.
//
// PARÂMETROS:
//   endpoint  → qual caminho da API chamar (ex: "/instance/connect/minha-instancia")
//   metodo    → "GET" para buscar dados, "POST" para enviar dados
//   corpo     → os dados enviados no POST (em formato de objeto JS)
//
// RETORNO:
//   { sucesso: true, dados: {...} }   ← quando deu certo
//   { sucesso: false, erro: "..." }   ← quando deu errado
// ---------------------------------------------------------------
async function chamarAPI(endpoint, metodo = 'GET', corpo = null) {
    const config = carregarConfigAPI();

    // Se o usuário ainda não configurou, avisa imediatamente
    if (!apiEstaConfigurada()) {
        return {
            sucesso: false,
            erro: 'A API ainda não foi configurada. Clique em "Configurações" para preencher.'
        };
    }

    const url = `${config.baseUrl}${endpoint}`;

    // Monta as opções da requisição HTTP
    const opcoes = {
        method: metodo,
        headers: {
            'Content-Type': 'application/json',
            // A Evolution API usa o header "apikey" para saber quem está fazendo a chamada
            'apikey': config.apiKey
        }
    };

    // Se tiver dados para enviar, serializa como JSON
    if (corpo) {
        opcoes.body = JSON.stringify(corpo);
    }

    try {
        const resposta = await fetch(url, opcoes);

        // Tenta converter a resposta para JSON
        let dados;
        try {
            dados = await resposta.json();
        } catch {
            dados = {};
        }

        // Se o servidor retornou erro HTTP (4xx ou 5xx)
        if (!resposta.ok) {
            return {
                sucesso: false,
                erro: dados?.message || `Erro HTTP ${resposta.status}`
            };
        }

        return { sucesso: true, dados };

    } catch (erro) {
        // Erro de rede (servidor fora do ar, URL errada, etc.)
        return {
            sucesso: false,
            erro: 'Não foi possível conectar ao servidor. Verifique a URL da API.'
        };
    }
}


// ---------------------------------------------------------------
// VERIFICAR STATUS DA CONEXÃO
//
// Pergunta à Evolution API se o WhatsApp está conectado ou não.
//
// POSSÍVEIS ESTADOS RETORNADOS PELA API:
//   "open"       → WhatsApp conectado e funcionando ✅
//   "close"      → WhatsApp desconectado ❌
//   "connecting" → Tentando conectar (aguardando QR Code)
// ---------------------------------------------------------------
async function verificarConexao() {
    const config = carregarConfigAPI();
    const resultado = await chamarAPI(`/instance/connectionState/${config.instancia}`);

    if (!resultado.sucesso) {
        return { conectado: false, estado: 'erro', mensagem: resultado.erro };
    }

    const estado = resultado.dados?.instance?.state || 'close';

    return {
        conectado: estado === 'open',
        estado,
        mensagem: estado === 'open' ? 'WhatsApp conectado' : 'WhatsApp desconectado'
    };
}


// ---------------------------------------------------------------
// OBTER QR CODE
//
// Gera o QR Code que o usuário vai escanear com o WhatsApp
// para vincular o número ao sistema.
//
// O QR Code vem em formato Base64, que é uma imagem em texto.
// Usamos diretamente na tag <img src="..."> do HTML.
// ---------------------------------------------------------------
async function obterQRCode() {
    const config = carregarConfigAPI();
    const resultado = await chamarAPI(`/instance/connect/${config.instancia}`);

    if (!resultado.sucesso) {
        return { sucesso: false, erro: resultado.erro };
    }

    const base64 = resultado.dados?.base64;

    if (!base64) {
        return {
            sucesso: false,
            erro: 'QR Code indisponível. O WhatsApp pode já estar conectado ou a instância não existe.'
        };
    }

    return { sucesso: true, qrCode: base64 };
}


// ---------------------------------------------------------------
// FORMATAR NÚMERO DE TELEFONE
//
// A Evolution API exige o número no formato internacional.
// Esta função converte qualquer formato para o padrão correto.
//
// EXEMPLOS:
//   "(11) 99999-9999"   →  "5511999999999"
//   "11999999999"       →  "5511999999999"
//   "5511999999999"     →  "5511999999999"  (já está certo)
//
// Retorna null se o número não tiver um tamanho válido.
// ---------------------------------------------------------------
function formatarNumero(numero) {
    // Remove tudo que não for dígito (espaços, traços, parênteses, etc.)
    const digitos = String(numero).replace(/\D/g, '');

    if (digitos.length === 11)  return `55${digitos}`;  // DDD + 9 dígitos
    if (digitos.length === 10)  return `55${digitos}`;  // DDD + 8 dígitos (número antigo)
    if (digitos.length === 13)  return digitos;          // Já tem código do Brasil (55)
    if (digitos.length === 12)  return digitos;          // Já tem código do Brasil sem 9

    return null; // Número inválido
}


// ---------------------------------------------------------------
// ENVIAR MENSAGEM DE TEXTO
//
// Envia uma mensagem para qualquer número de WhatsApp.
// O número é formatado automaticamente antes do envio.
// ---------------------------------------------------------------
async function enviarMensagem(numeroOriginal, texto) {
    const numero = formatarNumero(numeroOriginal);

    if (!numero) {
        return {
            sucesso: false,
            erro: `Número inválido: "${numeroOriginal}". Use o formato (11) 99999-9999.`
        };
    }

    const config = carregarConfigAPI();

    const resultado = await chamarAPI(
        `/message/sendText/${config.instancia}`,
        'POST',
        { number: numero, text: texto }
    );

    return resultado;
}


// ---------------------------------------------------------------
// TEMPLATES DE MENSAGEM
//
// Cada função abaixo monta e envia um tipo específico de mensagem.
// São chamadas automaticamente pelo sistema quando algo acontece
// (ex: quando um empréstimo é registrado, envia a confirmação).
//
// O "*texto*" cria negrito no WhatsApp.
// O "\n" pula uma linha na mensagem.
// ---------------------------------------------------------------

/** Enviada automaticamente quando um empréstimo é registrado */
async function enviarConfirmacaoEmprestimo(nomeAluno, numero, tituloLivro, dataDevolucao) {
    const texto =
        `Olá, *${nomeAluno}*! 📚\n\n` +
        `Seu empréstimo foi registrado com sucesso na *Biblioteca Jorge Amado*.\n\n` +
        `📖 Livro: *${tituloLivro}*\n` +
        `📅 Devolução prevista: *${dataDevolucao}*\n\n` +
        `Qualquer dúvida, procure a biblioteca. Boa leitura! 😊`;

    return await enviarMensagem(numero, texto);
}

/** Enviada um dia antes do prazo de devolução */
async function enviarLembreteDevolvucao(nomeAluno, numero, tituloLivro, dataDevolucao) {
    const texto =
        `Olá, *${nomeAluno}*! ⏰\n\n` +
        `Lembrete da *Biblioteca Jorge Amado*:\n\n` +
        `O livro *"${tituloLivro}"* deve ser devolvido amanhã, *${dataDevolucao}*.\n\n` +
        `Contamos com você! 📚`;

    return await enviarMensagem(numero, texto);
}

/** Enviada quando o prazo de devolução já passou */
async function enviarAvisoAtraso(nomeAluno, numero, tituloLivro, diasAtraso) {
    const texto =
        `Olá, *${nomeAluno}*! ⚠️\n\n` +
        `Aviso da *Biblioteca Jorge Amado*:\n\n` +
        `O livro *"${tituloLivro}"* está em atraso há *${diasAtraso} dia(s)*.\n\n` +
        `Por favor, devolva o quanto antes para evitar bloqueio do seu cadastro.`;

    return await enviarMensagem(numero, texto);
}

/** Enviada quando o aluno devolve o livro */
async function enviarConfirmacaoDevolucao(nomeAluno, numero, tituloLivro) {
    const texto =
        `Olá, *${nomeAluno}*! ✅\n\n` +
        `A devolução do livro *"${tituloLivro}"* foi confirmada na *Biblioteca Jorge Amado*.\n\n` +
        `Obrigado! Esperamos te ver em breve. 📚`;

    return await enviarMensagem(numero, texto);
}


// ---------------------------------------------------------------
// EXPORTAR FUNÇÕES PARA USO GLOBAL
//
// Ao incluir este arquivo com <script src="conexao-api.js">,
// todas essas funções ficam disponíveis em qualquer outro arquivo
// JS da mesma página através de "ChatbotAPI.nomeDaFuncao(...)".
//
// EXEMPLO DE USO NO emprestimo.js:
//   await ChatbotAPI.enviarConfirmacaoEmprestimo('João', '11999999999', 'Dom Casmurro', '10/06/2025');
// ---------------------------------------------------------------
window.ChatbotAPI = {
    carregarConfigAPI,
    salvarConfigAPI,
    apiEstaConfigurada,
    verificarConexao,
    obterQRCode,
    enviarMensagem,
    enviarConfirmacaoEmprestimo,
    enviarLembreteDevolvucao,
    enviarAvisoAtraso,
    enviarConfirmacaoDevolucao
};
