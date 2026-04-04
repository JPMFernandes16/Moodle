// js/auth.js
import { playClick, playSadSound } from './audio.js';
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js"; // <-- Adicionámos o signOut

export function initAuth() {
    const securityLayer = document.getElementById("security-layer");
    const emailInput = document.getElementById("app-email");
    const pwdInput = document.getElementById("app-password");
    const btnUnlock = document.getElementById("btn-unlock");
    const pwdError = document.getElementById("pwd-error");
    const btnLogout = document.getElementById("btnLogout"); // <-- O novo botão de sair

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
            
            // Limpar dados sensíveis por precaução
            pwdInput.value = "";
            btnUnlock.textContent = "Entrar no Moodle";
            btnUnlock.disabled = false;
            pwdError.style.display = "none";
        }
    });

    // 2. ENTRAR (Fazer Login)
    btnUnlock.addEventListener("click", async () => {
        const email = emailInput.value.trim();
        const password = pwdInput.value;
        
        if (!email || !password) {
            pwdError.textContent = "Preenche o email e a palavra-passe.";
            pwdError.style.display = "block";
            return;
        }

        try {
            btnUnlock.textContent = "A verificar...";
            btnUnlock.disabled = true;

            // Pedido ao Firebase
            await signInWithEmailAndPassword(auth, email, password);
            
            // Sucesso!
            playClick();
            pwdError.style.display = "none";
            securityLayer.style.opacity = "0";
            securityLayer.style.visibility = "hidden";
            setTimeout(() => securityLayer.style.display = "none", 500);
            
        } catch (error) {
            console.error("Erro no login:", error.code);
            pwdError.style.display = "block";
            pwdError.textContent = "ACESSO NEGADO: CREDENCIAIS INVÁLIDAS";
            pwdInput.value = "";
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
                // NOTA: Não precisamos de esconder nada manualmente aqui. 
                // O `onAuthStateChanged` lá em cima deteta o logout automaticamente e mostra o ecrã!
            } catch (error) {
                console.error("Erro ao terminar sessão:", error);
            }
        });
    }
}