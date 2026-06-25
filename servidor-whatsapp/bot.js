const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeLib      = require('qrcode');
const express        = require('express');
const cors           = require('cors');
const fs             = require('fs');
const path           = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..')));

let estado     = 'desconectado'; // 'desconectado' | 'aguardando_qr' | 'conectado'
let qrAtual    = null;

// --- HISTÓRICO ---
const HISTORICO_FILE = path.join(__dirname, 'historico.json');
let historicoEnvios = [];

try {
    if (fs.existsSync(HISTORICO_FILE)) {
        historicoEnvios = JSON.parse(fs.readFileSync(HISTORICO_FILE, 'utf8'));
    }
} catch { historicoEnvios = []; }

function salvarEntradaHistorico(entry) {
    historicoEnvios.unshift(entry);
    if (historicoEnvios.length > 500) historicoEnvios.splice(500);
    try { fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historicoEnvios), 'utf8'); } catch {}
}

// --- CLIENTE WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox']
    }
});

client.on('qr', async (qr) => {
    estado  = 'aguardando_qr';
    qrAtual = await qrcodeLib.toDataURL(qr);
    qrcodeTerminal.generate(qr, { small: true });
    console.log('📱 QR Code gerado — escaneie pelo WhatsApp.');
});

client.on('ready', () => {
    estado  = 'conectado';
    qrAtual = null;
    console.log('✅ WhatsApp conectado!');
});

client.on('disconnected', async (reason) => {
    estado  = 'desconectado';
    qrAtual = null;
    console.log('❌ WhatsApp desconectado:', reason);
    console.log('🔄 Reiniciando em 5 segundos para gerar novo QR Code...');

    setTimeout(async () => {
        try {
            await client.destroy();
        } catch {}
        await client.initialize();
    }, 5000);
});

client.on('message', msg => {
    if (msg.body.toLowerCase() === 'oi') {
        msg.reply('Olá! O sistema da biblioteca está funcionando. 📚');
    }
});

// --- ENDPOINTS ---

// Status da conexão
app.get('/api/status', (req, res) => {
    res.json({
        conectado: estado === 'conectado',
        estado,
        mensagem: estado === 'conectado' ? 'WhatsApp conectado' : 'Aguardando conexão'
    });
});

// QR Code em base64 para exibir no navegador
app.get('/api/qrcode', (req, res) => {
    if (!qrAtual) {
        return res.json({ sucesso: false, erro: 'QR Code não disponível. Aguarde ou reinicie o servidor.' });
    }
    res.json({ sucesso: true, qrCode: qrAtual });
});

// Enviar mensagem (usado pelo chatbot e pelo emprestimo.js)
app.post('/api/send-message', async (req, res) => {
    const { number, text, meta = {} } = req.body;
    if (!number || !text) {
        return res.status(400).json({ sucesso: false, erro: 'Campos number e text são obrigatórios.' });
    }
    if (estado !== 'conectado') {
        return res.status(503).json({ sucesso: false, erro: 'WhatsApp não está conectado.' });
    }
    try {
        await client.sendMessage(`${number}@c.us`, text);
        salvarEntradaHistorico({
            nomeAluno: meta.nomeAluno || 'N/A',
            numero: number,
            tipo: meta.tipo || 'automatica',
            status: 'enviado',
            data: new Date().toISOString()
        });
        res.json({ sucesso: true });
    } catch (err) {
        console.error('Erro ao enviar:', err.message);
        salvarEntradaHistorico({
            nomeAluno: meta.nomeAluno || 'N/A',
            numero: number,
            tipo: meta.tipo || 'automatica',
            status: 'erro',
            data: new Date().toISOString()
        });
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// Enviar notificação (usado pelo botão "Enviar pelo WhatsApp" do chatbot)
app.post('/enviar-notificacao', async (req, res) => {
    const { telefone, mensagem, nomeAluno, tipo } = req.body;
    if (!telefone || !mensagem) {
        return res.status(400).json({ sucesso: false, erro: 'Campos telefone e mensagem são obrigatórios.' });
    }
    if (estado !== 'conectado') {
        return res.status(503).json({ sucesso: false, erro: 'WhatsApp não está conectado.' });
    }
    try {
        const digitos = String(telefone).replace(/\D/g, '');
        const numero  = digitos.length <= 11 ? `55${digitos}` : digitos;
        await client.sendMessage(`${numero}@c.us`, mensagem);
        salvarEntradaHistorico({
            nomeAluno: nomeAluno || 'N/A',
            numero: telefone,
            tipo: tipo || 'personalizada',
            status: 'enviado',
            data: new Date().toISOString()
        });
        res.json({ sucesso: true });
    } catch (err) {
        console.error('Erro ao enviar notificação:', err.message);
        salvarEntradaHistorico({
            nomeAluno: nomeAluno || 'N/A',
            numero: telefone,
            tipo: tipo || 'personalizada',
            status: 'erro',
            data: new Date().toISOString()
        });
        res.status(500).json({ sucesso: false, erro: err.message });
    }
});

// Histórico de envios
app.get('/api/historico', (req, res) => {
    res.json(historicoEnvios);
});

// --- INICIAR ---
app.listen(3000, () => {
    console.log('🚀 Servidor rodando em http://localhost:3000');
    console.log('📂 Acesse: http://localhost:3000/Fronted%20sistema/chatbot/chatbot.html');
    console.log('   Aguardando WhatsApp conectar...\n');
});

client.initialize();
