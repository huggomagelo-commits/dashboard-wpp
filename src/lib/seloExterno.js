// ============================================================================
// O Netlify injeta um selo "Powered by Netlify" fixo no canto inferior direito
// (iframe #nl-badge-frame, 197x64px, z-index máximo). No celular ele cobre mais
// da metade da navegação inferior, e não dá para desenhar por cima dele.
//
// Em vez de escondê-lo — o que pode ferir os termos do plano —, o painel mede
// o selo e sobe a navegação exatamente o necessário. Se o selo deixar de
// existir (plano pago, outra hospedagem), a barra volta ao rodapé sozinha.
// ============================================================================

const VARIAVEL = "--selo-externo";

/** Elementos fixos no rodapé que não são nossos. */
function acharSelo() {
  const porId = document.getElementById("nl-badge-frame");
  if (porId) return porId;

  // fallback genérico: iframe fixo, colado no rodapé, filho direto do body
  for (const el of document.querySelectorAll("body > iframe")) {
    const estilo = getComputedStyle(el);
    if (estilo.position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && window.innerHeight - r.bottom < 4) return el;
  }
  return null;
}

function medir() {
  const selo = acharSelo();
  if (!selo) return 0;
  const r = selo.getBoundingClientRect();
  // só atrapalha quem está no rodapé à direita; margem de 2px para arredondamento
  if (window.innerHeight - r.bottom > 2) return 0;
  return Math.ceil(r.height);
}

function aplicar() {
  const altura = medir();
  document.documentElement.style.setProperty(VARIAVEL, `${altura}px`);
}

/**
 * Liga o ajuste automático. Devolve a função de limpeza.
 * O selo é injetado depois do carregamento, por isso as remedições.
 */
export function observarSeloExterno() {
  aplicar();

  const tentativas = [300, 900, 2000, 4000].map((ms) => setTimeout(aplicar, ms));
  window.addEventListener("resize", aplicar);

  const observador = new MutationObserver(aplicar);
  observador.observe(document.body, { childList: true });

  return () => {
    tentativas.forEach(clearTimeout);
    window.removeEventListener("resize", aplicar);
    observador.disconnect();
  };
}
