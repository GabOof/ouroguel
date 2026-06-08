let currentUser = null;
let authInitialized = false;

function isLoginPage() {
    return window.location.pathname.includes("/pages/login.html");
}

function isPrintPage() {
    return window.location.pathname.includes("/pages/imprimir.html");
}

function getLoginPath() {
    return "/pages/login.html";
}

function getHomePath() {
    return "/index.html";
}

async function aguardarFirebaseAuth() {
    if (window.firebaseReady) {
        await window.firebaseReady;
    }

    if (!window.auth || !window.db) {
        throw new Error("Firebase Auth ou Firestore não inicializado.");
    }

    return {
        auth: window.auth,
        db: window.db,
    };
}

function limparSessaoLocal() {
    localStorage.removeItem("userLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
}

function salvarSessaoLocal(user, userData = {}) {
    const nome = userData.nome || user.displayName || user.email.split("@")[0];
    const role = userData.role || "user";

    localStorage.setItem("userLoggedIn", "true");
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userId", user.uid);
    localStorage.setItem("userName", nome);
    localStorage.setItem("userRole", role);

    return {
        id: user.uid,
        nome,
        email: user.email,
        role,
    };
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById("logoutBtn");

    if (!logoutBtn) {
        return;
    }

    const novoBotao = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(novoBotao, logoutBtn);

    novoBotao.addEventListener("click", function (event) {
        event.preventDefault();
        logout();
    });
}

function updateUserBar(userInfo) {
    const userBar = document.getElementById("userBar");
    const userBarName = document.getElementById("userBarName");
    const userBarEmail = document.getElementById("userBarEmail");
    const userRoleText = document.getElementById("userRoleText");

    if (!userBar) {
        return;
    }

    if (!userInfo) {
        userBar.style.display = "none";
        return;
    }

    if (userBarName) {
        userBarName.textContent = userInfo.nome || "Usuário";
    }

    if (userBarEmail) {
        userBarEmail.textContent = userInfo.email || "";
    }

    if (userRoleText) {
        userRoleText.textContent = userInfo.role === "admin" ? "Administrador" : "Usuário";
    }

    userBar.style.display = "block";
    setupLogoutButton();
}

async function buscarOuCriarUsuario(user) {
    const { db } = await aguardarFirebaseAuth();

    const userRef = db.collection("usuarios").doc(user.uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
        const dados = userDoc.data();

        await userRef.update({
            ultimoLogin: new Date().toISOString(),
        });

        return dados;
    }

    const novoUsuario = {
        nome: user.displayName || user.email.split("@")[0],
        email: user.email,
        role: "user",
        status: "ativo",
        dataCriacao: new Date().toISOString(),
        ultimoLogin: new Date().toISOString(),
    };

    await userRef.set(novoUsuario);

    return novoUsuario;
}

async function initializeAuth() {
    if (authInitialized) {
        return;
    }

    try {
        const { auth } = await aguardarFirebaseAuth();

        authInitialized = true;

        auth.onAuthStateChanged(async function (user) {
            currentUser = user;

            if (user) {
                try {
                    const userData = await buscarOuCriarUsuario(user);
                    const userInfo = salvarSessaoLocal(user, userData);

                    updateUserBar(userInfo);

                    if (isLoginPage()) {
                        window.location.replace(getHomePath());
                    }
                } catch (error) {
                    console.error("Erro ao carregar perfil do usuário:", error);

                    const userInfo = salvarSessaoLocal(user, {
                        nome: user.displayName || user.email.split("@")[0],
                        role: "user",
                    });

                    updateUserBar(userInfo);

                    if (isLoginPage()) {
                        window.location.replace(getHomePath());
                    }
                }

                return;
            }

            limparSessaoLocal();
            updateUserBar(null);

            if (!isLoginPage() && !isPrintPage()) {
                window.location.replace(getLoginPath());
            }
        });
    } catch (error) {
        console.error("Erro ao inicializar autenticação:", error);

        if (!isLoginPage() && !isPrintPage()) {
            window.location.replace(getLoginPath());
        }
    }
}

function isUserLoggedIn() {
    return !!currentUser || !!window.auth?.currentUser;
}

async function getUserInfo() {
    try {
        const { auth } = await aguardarFirebaseAuth();

        const user = auth.currentUser;

        if (!user) {
            return null;
        }

        const userData = await buscarOuCriarUsuario(user);

        return {
            id: user.uid,
            email: user.email,
            nome: userData.nome || user.displayName || user.email.split("@")[0],
            role: userData.role || "user",
        };
    } catch (error) {
        console.error("Erro ao buscar informações do usuário:", error);
        return null;
    }
}

async function loadUserProfile() {
    const userInfo = await getUserInfo();

    if (userInfo) {
        updateUserBar(userInfo);
    }
}

async function logout() {
    const confirmar = confirm("Deseja sair do sistema?");

    if (!confirmar) {
        return;
    }

    try {
        const { auth } = await aguardarFirebaseAuth();

        await auth.signOut();

        limparSessaoLocal();

        window.location.replace(getLoginPath());
    } catch (error) {
        console.error("Erro ao sair:", error);
        alert("Erro ao sair do sistema: " + error.message);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    initializeAuth();
});

window.logout = logout;
window.isUserLoggedIn = isUserLoggedIn;
window.getUserInfo = getUserInfo;
window.loadUserProfile = loadUserProfile;
window.updateUserBar = updateUserBar;
window.initializeAuth = initializeAuth;

// ============================
// MODAL DE DADOS DO USUÁRIO
// ============================

(function inicializarModalUsuario() {
    document.addEventListener("DOMContentLoaded", function () {
        const modal = document.getElementById("modalUsuario");
        const abrirModalBtn = document.getElementById("userBarName");
        const fecharModalBtn = document.getElementById("fecharModalUsuario");
        const cancelarModalBtn = document.getElementById("cancelarModalUsuario");
        const formUsuario = document.getElementById("formUsuario");

        const inputNome = document.getElementById("usuarioNome");
        const inputEmail = document.getElementById("usuarioEmail");
        const inputTelefone = document.getElementById("usuarioTelefone");
        const inputCargo = document.getElementById("usuarioCargo");

        const mensagem = document.getElementById("modalUsuarioMensagem");
        const salvarBtn = document.getElementById("salvarUsuarioBtn");

        const userBarName = document.getElementById("userBarName");
        const userRoleText = document.getElementById("userRoleText");

        if (!modal || !abrirModalBtn || !formUsuario) {
            return;
        }

        function firebaseDisponivel() {
            return window.firebase && firebase.auth && firebase.firestore;
        }

        function aguardarUsuarioFirebase() {
            return new Promise(function (resolve) {
                if (!firebaseDisponivel()) {
                    resolve(null);
                    return;
                }

                const usuarioAtual = firebase.auth().currentUser;

                if (usuarioAtual) {
                    resolve(usuarioAtual);
                    return;
                }

                let finalizado = false;
                let cancelarObservador = function () {};

                cancelarObservador = firebase.auth().onAuthStateChanged(function (usuario) {
                    if (finalizado) return;

                    finalizado = true;
                    cancelarObservador();
                    resolve(usuario);
                });

                setTimeout(function () {
                    if (finalizado) return;

                    finalizado = true;
                    cancelarObservador();
                    resolve(firebase.auth().currentUser || null);
                }, 1000);
            });
        }

        function limparMensagem() {
            mensagem.textContent = "";
            mensagem.classList.remove("sucesso", "erro");
        }

        function mostrarMensagem(texto, tipo) {
            mensagem.textContent = texto;
            mensagem.classList.remove("sucesso", "erro");
            mensagem.classList.add(tipo);
        }

        function abrirModal() {
            modal.hidden = false;
            document.body.style.overflow = "hidden";

            limparMensagem();
            carregarDadosUsuario();

            setTimeout(function () {
                inputNome.focus();
            }, 100);
        }

        function fecharModal() {
            modal.hidden = true;
            document.body.style.overflow = "";
            limparMensagem();
        }

        async function carregarDadosUsuario() {
            const usuario = await aguardarUsuarioFirebase();

            const dadosPadrao = {
                nome: localStorage.getItem("userName") || localStorage.getItem("userEmail") || "",
                email: usuario?.email || localStorage.getItem("userEmail") || "",
                telefone: localStorage.getItem("userPhone") || "",
                cargo:
                    localStorage.getItem("userRole") ||
                    document.getElementById("userRoleText")?.textContent ||
                    "Usuário",
            };

            let dadosUsuario = { ...dadosPadrao };

            try {
                if (usuario && firebaseDisponivel()) {
                    const db = firebase.firestore();

                    const docUsuario = await db.collection("usuarios").doc(usuario.uid).get();

                    if (docUsuario.exists) {
                        dadosUsuario = {
                            ...dadosUsuario,
                            ...docUsuario.data(),
                        };
                    }
                }
            } catch (erro) {
                console.warn("Não foi possível carregar dados do usuário:", erro);
            }

            inputNome.value = dadosUsuario.nome || "";
            inputEmail.value = usuario?.email || dadosUsuario.email || "";
            inputTelefone.value = dadosUsuario.telefone || "";
            inputCargo.value = dadosUsuario.cargo || "Usuário";
        }

        async function salvarDadosUsuario(event) {
            event.preventDefault();

            limparMensagem();

            const nome = inputNome.value.trim();
            const novoEmail = inputEmail.value.trim();
            const telefone = inputTelefone.value.trim();

            if (!nome) {
                mostrarMensagem("Informe o nome do usuário.", "erro");
                inputNome.focus();
                return;
            }

            if (!novoEmail) {
                mostrarMensagem("Informe o e-mail do usuário.", "erro");
                inputEmail.focus();
                return;
            }

            salvarBtn.disabled = true;
            salvarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

            try {
                const usuario = await aguardarUsuarioFirebase();

                if (!usuario) {
                    throw new Error("Usuário autenticado não encontrado.");
                }

                const emailAtual = usuario.email || localStorage.getItem("userEmail") || "";
                const emailFoiAlterado = novoEmail.toLowerCase() !== emailAtual.toLowerCase();

                const dadosAtualizados = {
                    nome,
                    email: emailAtual,
                    telefone,
                    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                };

                const db = firebase.firestore();

                await db
                    .collection("usuarios")
                    .doc(usuario.uid)
                    .set(
                        {
                            uid: usuario.uid,
                            ...dadosAtualizados,
                        },
                        { merge: true }
                    );

                localStorage.setItem("userName", nome);
                localStorage.setItem("userPhone", telefone);

                if (userBarName) {
                    userBarName.textContent = nome;
                }

                if (emailFoiAlterado) {
                    if (typeof usuario.verifyBeforeUpdateEmail !== "function") {
                        throw new Error(
                            "Seu SDK do Firebase não possui verifyBeforeUpdateEmail disponível."
                        );
                    }

                    await usuario.verifyBeforeUpdateEmail(novoEmail, {
                        url: window.location.origin + "/index.html",
                        handleCodeInApp: false,
                    });

                    await db.collection("usuarios").doc(usuario.uid).set(
                        {
                            emailPendente: novoEmail,
                            emailPendenteCriadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                    );

                    mostrarMensagem(
                        "Dados salvos. Enviamos um e-mail de confirmação para o novo endereço.",
                        "sucesso"
                    );
                } else {
                    mostrarMensagem("Dados atualizados com sucesso.", "sucesso");
                }

                setTimeout(function () {
                    fecharModal();
                }, 1200);
            } catch (erro) {
                console.error("Erro ao salvar dados do usuário:", erro);

                if (erro.code === "auth/requires-recent-login") {
                    mostrarMensagem(
                        "Por segurança, faça login novamente antes de alterar o e-mail.",
                        "erro"
                    );
                    return;
                }

                if (erro.code === "auth/invalid-email") {
                    mostrarMensagem("O e-mail informado é inválido.", "erro");
                    return;
                }

                if (erro.code === "auth/email-already-in-use") {
                    mostrarMensagem("Este e-mail já está em uso por outro usuário.", "erro");
                    return;
                }

                mostrarMensagem(
                    "Não foi possível salvar os dados. Verifique as permissões do Firestore.",
                    "erro"
                );
            } finally {
                salvarBtn.disabled = false;
                salvarBtn.innerHTML = '<i class="fas fa-save"></i> Salvar alterações';
            }
        }

        abrirModalBtn.addEventListener("click", abrirModal);

        abrirModalBtn.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                abrirModal();
            }
        });

        fecharModalBtn?.addEventListener("click", fecharModal);
        cancelarModalBtn?.addEventListener("click", fecharModal);

        modal.addEventListener("click", function (event) {
            if (event.target === modal) {
                fecharModal();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !modal.hidden) {
                fecharModal();
            }
        });

        formUsuario.addEventListener("submit", salvarDadosUsuario);
    });
})();
