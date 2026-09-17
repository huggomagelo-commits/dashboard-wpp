// ============================================================================
// Camada de conexão com o WhatsApp.
//
// Esta é a "porta aberta" que combinamos: a interface abaixo é a única coisa
// que o painel conhece. Hoje ela é atendida por um simulador; na Fase 3 entra
// o adaptador Baileys (QR Code) e, se um dia for preciso migrar, entra o
// adaptador da Cloud API oficial — sem tocar em nenhuma tela.
//
//   conectar()        inicia a sessão e emite o QR Code
//   desconectar()     encerra a sessão
//   assinar(fn)       recebe eventos: qr | conectado | desconectado | mensagem
//   enviar(tel, txt)  envia uma mensagem de texto
//   status()          estado atual da conexão
// ============================================================================

const ESTADOS = ["desconectado", "aguardando_qr", "conectando", "conectado", "erro"];

function criarAdaptadorSimulado() {
  let estado = "desconectado";
  let numero = null;
  let desde = null;
  let qr = null;
  const ouvintes = new Set();
  let cronometro = null;

  const emitir = (evento) => ouvintes.forEach((fn) => fn(evento));

  const gerarQr = () => {
    // payload no formato do WhatsApp Web (ref,chave pública,identificador)
    const aleatorio = () => Math.random().toString(36).slice(2, 12).toUpperCase();
    return `2@${aleatorio()}${aleatorio()},${aleatorio()}${aleatorio()}=,${aleatorio()}=`;
  };

  return {
    ESTADOS,

    status: () => ({ estado, numero, desde, qr }),

    assinar(fn) {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    },

    async conectar() {
      clearInterval(cronometro);
      estado = "aguardando_qr";
      qr = gerarQr();
      emitir({ tipo: "qr", qr, estado });

      // o QR real do WhatsApp expira a cada ~20s e é renovado sozinho
      cronometro = setInterval(() => {
        if (estado !== "aguardando_qr") return clearInterval(cronometro);
        qr = gerarQr();
        emitir({ tipo: "qr", qr, estado });
      }, 20_000);

      return { estado, qr };
    },

    /** No adaptador real isto acontece quando o celular lê o código. */
    async simularLeitura(numeroInformado = "5511999990000") {
      clearInterval(cronometro);
      estado = "conectando";
      emitir({ tipo: "estado", estado });
      await new Promise((r) => setTimeout(r, 1200));
      estado = "conectado";
      numero = numeroInformado;
      desde = new Date().toISOString();
      qr = null;
      emitir({ tipo: "conectado", estado, numero, desde });
      return { estado, numero };
    },

    async desconectar() {
      clearInterval(cronometro);
      estado = "desconectado";
      numero = null;
      desde = null;
      qr = null;
      emitir({ tipo: "desconectado", estado });
    },

    async enviar(telefone, texto) {
      if (estado !== "conectado") {
        // Fase 1: o painel funciona sem conexão, só registra o envio localmente
        return { ok: true, simulado: true, telefone, texto };
      }
      await new Promise((r) => setTimeout(r, 300));
      return { ok: true, simulado: false, telefone, texto, id: `wamid.${Date.now()}` };
    },
  };
}

// ---------------------------------------------------------------------------
// Troca de adaptador: quando o bridge existir, basta apontar a URL aqui.
// const API = import.meta.env.VITE_BRIDGE_URL;
// export const whatsapp = API ? criarAdaptadorBridge(API) : criarAdaptadorSimulado();
// ---------------------------------------------------------------------------

export const whatsapp = criarAdaptadorSimulado();
