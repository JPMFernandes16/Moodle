import { playClick, playSadSound } from './audio.js';

export function initAuth() {
    const PALAVRA_PASSE_SECRETA = "iscap2026"; 
    const securityLayer = document.getElementById("security-layer");
    const pwdInput = document.getElementById("app-password");
    const btnUnlock = document.getElementById("btn-unlock");
    const pwdError = document.getElementById("pwd-error");

    if (securityLayer && btnUnlock) {
        if (localStorage.getItem("app-unlocked") === "true") {
            securityLayer.style.display = "none";
        } else {
            btnUnlock.addEventListener("click", () => {
                if (pwdInput.value === PALAVRA_PASSE_SECRETA) {
                    localStorage.setItem("app-unlocked", "true");
                    securityLayer.style.opacity = "0";
                    securityLayer.style.visibility = "hidden";
                    setTimeout(() => securityLayer.style.display = "none", 500);
                    playClick(); 
                } else {
                    pwdError.style.display = "block";
                    pwdInput.value = "";
                    playSadSound(); 
                }
            });
        }
    }
}