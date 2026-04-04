// js/auth.js
import { playClick, playSadSound } from './audio.js';
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
            // Sessão ativa! Esconder o ecrã de bloqueio
            securityLayer.style.display = "none";
            console.log("Sessão ativa com:", user.email);
        } else {
            // REGRAS DE SEGURANÇA FRONTEND: Sem sessão. Trancar tudo!
            securityLayer.style.display = "flex";
            securityLayer.style.opacity = "1";
            securityLayer.style.visibility = "visible";
            
            // Limpar dados sensíveis por precaução (Segurança Extra para partilha de dispositivo)
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
            e.preventDefault(); // Evita recarregar a página acidentalmente
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
            
            // Sucesso!
            playClick();
            pwdError.style.display = "none";
            securityLayer.style.opacity = "0";
            securityLayer.style.visibility = "hidden";
            
            // Reativar os campos silenciosamente no fundo após a animação (0.5s)
            setTimeout(() => {
                securityLayer.style.display = "none";
                emailInput.disabled = false;
                pwdInput.disabled = false;
            }, 500);
            
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
        }
    });

    // 3. SAIR (Terminar Sessão)
    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            try {
                await signOut(auth); // Pede à Cloud para invalidar a sessão
                playClick();
            } catch (error) {
                console.error("Erro ao terminar sessão:", error);
            }
        });
    }
}