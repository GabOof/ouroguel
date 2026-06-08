let isProcessingLogin = false;
let isProcessingRegister = false;

history.pushState(null, null, location.href);
window.onpopstate = function () {
    history.go(1);
};

function togglePassword() {
    const passwordInput = document.getElementById("password");
    const eyeIcon = document.querySelector("#togglePasswordBtn i");

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        passwordInput.type = "password";
        eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function toggleRegisterPassword() {
    const passwordInput = document.getElementById("registerPassword");
    const eyeIcon = document.querySelector("#toggleRegisterPasswordBtn i");

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        passwordInput.type = "password";
        eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function showRegister() {
    document.querySelector(".login-card:first-child").style.display = "none";
    document.getElementById("registerCard").style.display = "block";
}

function showLogin() {
    document.querySelector(".login-card:first-child").style.display = "block";
    document.getElementById("registerCard").style.display = "none";
}

function forgotPassword() {
    const email = document.getElementById("email").value;
    if (!email) {
        alert("Por favor, insira seu e-mail para recuperar a senha.");
        return;
    }

    if (!window.auth) {
        alert("Sistema de autenticação não disponível.");
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            alert("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
        })
        .catch((error) => {
            let mensagem = "";
            switch (error.code) {
                case "auth/user-not-found":
                    mensagem = "E-mail não cadastrado.";
                    break;
                case "auth/invalid-email":
                    mensagem = "E-mail inválido.";
                    break;
                default:
                    mensagem = "Erro ao enviar e-mail de recuperação.";
            }
            alert(mensagem);
        });
}

async function handleLogin(e) {
    e.preventDefault();

    if (isProcessingLogin) {
        return;
    }

    isProcessingLogin = true;

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const remember = document.getElementById("remember").checked;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const textoOriginal = submitBtn.innerHTML;

    if (!email || !password) {
        alert("Preencha todos os campos.");
        isProcessingLogin = false;
        return;
    }

    try {
        if (window.firebaseReady) {
            await window.firebaseReady;
        }

        if (!window.auth || !window.db) {
            throw new Error("Sistema de autenticação não está disponível.");
        }

        if (!window.USANDO_FIREBASE_EMULATOR) {
            console.warn("Atenção: o login está usando Firebase de produção.");
        }

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        submitBtn.disabled = true;

        const persistence = remember
            ? window.firebase.auth.Auth.Persistence.LOCAL
            : window.firebase.auth.Auth.Persistence.SESSION;

        await window.auth.setPersistence(persistence);

        const userCredential = await window.auth.signInWithEmailAndPassword(email, password);

        const user = userCredential.user;

        const userRef = window.db.collection("usuarios").doc(user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            await userRef.set({
                nome: user.displayName || email.split("@")[0],
                email: email,
                role: "user",
                status: "ativo",
                dataCriacao: new Date().toISOString(),
                ultimoLogin: new Date().toISOString(),
            });
        } else {
            await userRef.update({
                ultimoLogin: new Date().toISOString(),
            });
        }

        window.location.replace("/index.html");
    } catch (error) {
        console.error("Erro no login:", error);

        submitBtn.innerHTML = textoOriginal;
        submitBtn.disabled = false;
        isProcessingLogin = false;

        let mensagem;

        switch (error.code) {
            case "auth/user-not-found":
                mensagem = "Usuário não encontrado. Verifique o e-mail.";
                break;
            case "auth/wrong-password":
                mensagem = "Senha incorreta. Tente novamente.";
                break;
            case "auth/invalid-email":
                mensagem = "E-mail inválido. Verifique o formato.";
                break;
            case "auth/invalid-login-credentials":
                mensagem = "Credenciais inválidas. Verifique e-mail e senha.";
                break;
            case "auth/too-many-requests":
                mensagem = "Muitas tentativas. Tente novamente mais tarde.";
                break;
            case "auth/network-request-failed":
                mensagem = "Erro de conexão. Verifique sua internet.";
                break;
            case "auth/user-disabled":
                mensagem = "Esta conta foi desativada.";
                break;
            default:
                mensagem = "Erro ao fazer login: " + error.message;
        }

        alert(mensagem);
    }
}

async function handleRegister(e) {
    e.preventDefault();

    if (isProcessingRegister) return;
    isProcessingRegister = true;

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("registerConfirmPassword").value;

    if (!name || !email || !password || !confirmPassword) {
        alert("Preencha todos os campos");
        isProcessingRegister = false;
        return;
    }

    if (password.length < 6) {
        alert("A senha deve ter pelo menos 6 caracteres");
        isProcessingRegister = false;
        return;
    }

    if (password !== confirmPassword) {
        alert("As senhas não coincidem");
        isProcessingRegister = false;
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando conta...';
    submitBtn.disabled = true;

    try {
        if (window.firebaseReady) {
            await window.firebaseReady;
        }

        if (!window.auth || !window.db) {
            throw new Error("Sistema de autenticação não está disponível.");
        }

        const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
            await user.sendEmailVerification({
                url: window.location.origin + "/pages/login.html",
                handleCodeInApp: false,
            });

            await window.auth.signOut();

            alert(
                "Seu e-mail ainda não foi confirmado. Enviamos um novo link de confirmação para sua caixa de entrada."
            );

            submitBtn.innerHTML = textoOriginal;
            submitBtn.disabled = false;
            isProcessingLogin = false;
            return;
        }

        await user.updateProfile({
            displayName: name,
        });

        await window.db.collection("usuarios").doc(user.uid).set({
            uid: user.uid,
            nome: name,
            email: user.email,
            role: "user",
            emailVerificado: user.emailVerified,
            dataCriacao: new Date().toISOString(),
            ultimoLogin: new Date().toISOString(),
            status: "ativo",
        });

        await user.sendEmailVerification({
            url: window.location.origin + "/pages/login.html",
            handleCodeInApp: false,
        });

        await window.auth.signOut();

        localStorage.removeItem("userLoggedIn");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userId");
        localStorage.removeItem("userRole");
        localStorage.removeItem("userName");

        alert(
            "✅ Conta criada com sucesso! Enviamos um e-mail de confirmação. Verifique sua caixa de entrada antes de fazer login."
        );

        showLogin();

        document.getElementById("email").value = email;
        document.getElementById("password").value = "";
    } catch (error) {
        console.error("Erro no registro:", error);

        let mensagem = "";

        switch (error.code) {
            case "auth/email-already-in-use":
                mensagem = "❌ Este e-mail já está cadastrado.";
                break;
            case "auth/invalid-email":
                mensagem = "❌ E-mail inválido.";
                break;
            case "auth/weak-password":
                mensagem = "❌ Senha muito fraca. Use pelo menos 6 caracteres.";
                break;
            case "auth/network-request-failed":
                mensagem = "❌ Erro de conexão. Verifique sua internet.";
                break;
            case "auth/unauthorized-continue-uri":
                mensagem = "❌ O domínio de redirecionamento não está autorizado no Firebase.";
                break;
            case "permission-denied":
                mensagem = "❌ Erro de permissão. Contate o administrador.";
                break;
            default:
                mensagem = "❌ Erro ao criar conta: " + error.message;
        }

        alert(mensagem);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        isProcessingRegister = false;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", handleRegister);
    }

    const togglePasswordBtn = document.getElementById("togglePasswordBtn");
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener("click", togglePassword);
    }

    const toggleRegisterPasswordBtn = document.getElementById("toggleRegisterPasswordBtn");
    if (toggleRegisterPasswordBtn) {
        toggleRegisterPasswordBtn.addEventListener("click", toggleRegisterPassword);
    }

    const showRegisterLink = document.getElementById("showRegisterLink");
    if (showRegisterLink) {
        showRegisterLink.addEventListener("click", function (e) {
            e.preventDefault();
            showRegister();
        });
    }

    const showLoginBtn = document.getElementById("showLoginBtn");
    if (showLoginBtn) {
        showLoginBtn.addEventListener("click", function (e) {
            e.preventDefault();
            showLogin();
        });
    }

    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener("click", function (e) {
            e.preventDefault();
            forgotPassword();
        });
    }

    const emailInput = document.getElementById("email");
    if (emailInput) {
        setTimeout(() => emailInput.focus(), 100);
    }
});

window.togglePassword = togglePassword;
window.toggleRegisterPassword = toggleRegisterPassword;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.forgotPassword = forgotPassword;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
