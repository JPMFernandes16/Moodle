// js/mediaViewer.js

import { state } from './store.js';

// ======================================================
// CATÁLOGO DE FICHEIROS (MULTIMÉDIA)
// ======================================================
const mediaCatalog = {
    "BIA_ABD_Exam": {
        pdfs: [
            { name: "Resumo Geral", file: "pdfs/BIA_ABD.pdf" }           
        ],
        videos: [
            { name: "Resumo", file: "videos/BIA_ABD.mp4" }
        ]
    },
    "BIA_ABD_Prep": {
        pdfs: [
            { name: "Resumo Geral", file: "pdfs/BIA_ABD.pdf" }
        ],
        videos: [
            { name: "Resumo", file: "videos/BIA_ABD.mp4" }
        ]
    },
    "GM_MR": {
        pdfs: [
            { name: "Resumo Marketing Relacional", file: "pdfs/GM_MR.pdf" }
        ],
        videos: []
    },
    "CV_JOAO": {
        pdfs: [
            { name: "Get to Know João Fernandes", file: "pdfs/CV_JOAO.pdf" }
        ],
        videos: [
            { name: "Vídeo de Apresentação", file: "videos/CV_JOAO.mp4" }
        ]
    }
};

// ======================================================
// LÓGICA DO MODAL
// ======================================================
export function openMediaModal(type) {
    const mediaModal = document.getElementById("mediaModal");
    const mediaContainer = document.getElementById("mediaContainer");
    const mediaModalTitle = document.getElementById("mediaModalTitle");

    if (!mediaModal || !state.currentDisciplina) return;
    
    mediaContainer.innerHTML = ""; // Limpa memória
    mediaModal.style.display = 'flex';
    
    // Garantir que o container usa flexbox para organizar o conteúdo
    mediaContainer.style.display = "flex";
    mediaContainer.style.flexDirection = "column";

    // Obter os ficheiros para a disciplina atual a partir do catálogo
    const discMedia = mediaCatalog[state.currentDisciplina] || { pdfs: [], videos: [] };
    const items = type === 'pdf' ? discMedia.pdfs : discMedia.videos;

    mediaModalTitle.textContent = type === 'pdf' ? "Escolher Resumo" : "Escolher Vídeo";

    if (items.length === 0) {
        mediaContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">Nenhum ficheiro disponível para esta disciplina.</div>`;
    } else if (items.length === 1) {
        // Se só existir 1 ficheiro, abre diretamente para manter a rapidez
        renderMediaContent(type, items[0].file, items[0].name);
    } else {
        // Se existirem múltiplos ficheiros, mostra um menu com botões
        let html = `<div style="padding: 20px; display: flex; flex-direction: column; gap: 15px; overflow-y: auto;">`;
        html += `<p style="text-align: center; color: var(--text-main); margin-bottom: 10px;">Seleciona o ficheiro que pretendes abrir:</p>`;
        
        items.forEach(item => {
            const icone = type === 'pdf' ? '📄' : '🎥';
            html += `<button class="btn btn--ghost media-select-btn" data-type="${type}" data-file="${item.file}" data-name="${item.name}" style="justify-content: flex-start; padding: 15px; border-color: var(--primary);">
                        ${icone} ${item.name}
                     </button>`;
        });
        html += `</div>`;
        mediaContainer.innerHTML = html;

        // Adicionar ação aos novos botões gerados
        document.querySelectorAll('.media-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fType = e.currentTarget.getAttribute('data-type');
                const fPath = e.currentTarget.getAttribute('data-file');
                const fName = e.currentTarget.getAttribute('data-name');
                renderMediaContent(fType, fPath, fName);
            });
        });
    }

    setTimeout(() => mediaModal.classList.add('show'), 10);
    document.body.style.overflow = "hidden";
}

// Função auxiliar para desenhar o leitor no ecrã após a escolha
function renderMediaContent(type, filePath, fileName) {
    const mediaContainer = document.getElementById("mediaContainer");
    const mediaModalTitle = document.getElementById("mediaModalTitle");

    mediaContainer.innerHTML = ""; // Limpa os botões de seleção
    mediaModalTitle.textContent = fileName || (type === 'pdf' ? "Visualizador PDF" : "Visualizador de Vídeo");
    
    if (type === 'pdf') {
        mediaContainer.innerHTML = `
          <div style="padding: 15px; text-align: center; background: var(--secondary); border-bottom: 1px solid var(--border);">
              <p style="margin: 0 0 10px 0; font-size: 0.8rem; color: var(--text-muted);">No telemóvel o PDF pode não carregar corretamente.</p>
              <a href="${filePath}" target="_blank" class="btn btn--primary" style="padding: 10px 20px; font-size: 0.85rem; width: 100%; border-radius: 8px;">
                  Abrir no Visualizador Externo
              </a>
          </div>
          <iframe src="${filePath}" width="100%" style="border: none; flex: 1; min-height: 50vh;"></iframe>
        `;
    } else if (type === 'video') {
        mediaContainer.innerHTML = `
          <video controls autoplay width="100%" height="100%" style="background: black; outline: none; flex: 1;">
              <source src="${filePath}" type="video/mp4">
              O teu browser não suporta a reprodução de vídeo.
          </video>`;
    }
}

// Inicializar os Listeners de Fecho do Modal
export function initMediaViewerListeners() {
    const closeMediaModal = document.getElementById("closeMediaModal");
    const mediaModal = document.getElementById("mediaModal");
    const mediaContainer = document.getElementById("mediaContainer");

    if (closeMediaModal) {
        closeMediaModal.addEventListener("click", () => {
            mediaModal.classList.remove('show');
            setTimeout(() => {
                mediaModal.style.display = 'none';
                mediaContainer.innerHTML = ""; 
                document.body.style.overflow = ""; 
            }, 300);
        });
    }
}