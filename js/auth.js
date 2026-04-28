// js/auth.js

import { playClick, playSadSound } from './audio.js';
import { showToast } from './utils.js'; // <-- NOVO: Importamos o sistema de notificações
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

export function initAuth() {
    const securityLayer = document.getElementById("security-layer");
    const emailInput = document.getElementById("app-email");
    const pwdInput = document.getElementById("app-password");
    const btnUnlock = document.getElementById("btn-unlock");
    const pwdError = document.getElementById("pwd-error");
    const btnLogout = document.getElementById("btnLogout");

    if (!securityLayer || !btnUnlock) return;

    // 1. GUARDIÃO DE ESTADO (Verificar se a sessão está ativa)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Sessão ativa: Desvanecer o ecrã de bloqueio suavemente
            securityLayer.style.opacity = "0";
            securityLayer.style.visibility = "hidden";
            setTimeout(() => {
                securityLayer.style.display = "none";
            }, 500);
        } else {
            // Sem sessão: Mostrar ecrã de bloqueio
            securityLayer.style.display = "flex";
            // Um pequeno atraso para permitir que o display: flex seja aplicado antes de animar a opacidade
            setTimeout(() => {
                securityLayer.style.opacity = "1";
                securityLayer.style.visibility = "visible";
            }, 10);
            
            // Limpar dados sensíveis
            emailInput.value = ""; 
            pwdInput.value = "";
            emailInput.disabled = false;
            pwdInput.disabled = false;
            btnUnlock.textContent = "Entrar no Moodle";
            btnUnlock.disabled = false;
            pwdError.style.display = "none";
        }
    });

    // 1.5 UX Extra: Permitir fazer login carregando no "Enter" no teclado
    pwdInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault(); 
            btnUnlock.click();
        }
    });

    // 2. ENTRAR (Fazer Login)
    btnUnlock.addEventListener("click", async () => {
        const email = emailInput.value.trim();
        const password = pwdInput.value;
        
        if (!email || !password) {
            pwdError.textContent = "Preenche o e-mail e a palavra-passe.";
            pwdError.style.display = "block";
            return;
        }

        try {
            // Estado de carregamento: trancar interface
            btnUnlock.textContent = "A verificar...";
            btnUnlock.disabled = true;
            emailInput.disabled = true;
            pwdInput.disabled = true;

            // Pedido ao Firebase
            await signInWithEmailAndPassword(auth, email, password);
            
            playClick();
            pwdError.style.display = "none";
            // A animação de saída agora é tratada automaticamente pelo onAuthStateChanged!
            
        } catch (error) {
            console.error("Erro no login:", error.code);
            pwdError.style.display = "block";
            
            // Tradução inteligente de erros
            if (error.code === 'auth/network-request-failed') {
                pwdError.textContent = "ERRO DE REDE: VERIFICA A TUA LIGAÇÃO";
            } else {
                pwdError.textContent = "ACESSO NEGADO: CREDENCIAIS INVÁLIDAS";
            }

            // Repor estado do formulário
            pwdInput.value = "";
            emailInput.disabled = false;
            pwdInput.disabled = false;
            btnUnlock.textContent = "Entrar no Moodle";
            btnUnlock.disabled = false;
            
            playSadSound();
            showToast("Falha na autenticação.", "error"); // <-- Feedback visual extra
        }
    });

    // 3. SAIR (Terminar Sessão)
    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            try {
                await signOut(auth); 
                playClick();
                showToast("Sessão terminada com sucesso.", "info"); // <-- Despedida amigável
            } catch (error) {
                console.error("Erro ao terminar sessão:", error);
            }
        });
    }
}