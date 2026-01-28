// Verificar se Firebase está pronto
function verificarFirebase() {
  if (!window.db || !window.auth) {
    console.warn("⚠️ Firebase não está pronto. Aguarde...");
    return false;
  }
  return true;
}

// Função para verificar login
function verificarLogin() {
  if (!verificarFirebase()) return false;

  const user = auth.currentUser;
  const path = window.location.pathname;

  // Se não está na página de login e não tem usuário, redirecionar
  if (!path.includes("login.html") && !user) {
    console.log("🔒 Usuário não autenticado, redirecionando para login...");
    window.location.href = "login.html";
    return false;
  }

  return !!user;
}

// Função para logout
function logout() {
  if (!verificarFirebase()) return;

  if (confirm("Deseja sair do sistema?")) {
    auth
      .signOut()
      .then(() => {
        localStorage.clear();
        window.location.href = "login.html";
      })
      .catch((error) => {
        console.error("Erro ao fazer logout:", error);
        alert("Erro ao sair do sistema");
      });
  }
}

// Função para obter informações do usuário
async function getUserInfo() {
  if (!verificarFirebase()) return null;

  const user = auth.currentUser;
  if (!user) return null;

  try {
    const userDoc = await db.collection("usuarios").doc(user.uid).get();

    if (userDoc.exists) {
      return {
        id: user.uid,
        email: user.email,
        ...userDoc.data(),
      };
    }

    return {
      id: user.uid,
      email: user.email,
      nome: user.displayName || user.email.split("@")[0],
      role: "user",
    };
  } catch (error) {
    console.error("Erro ao obter informações do usuário:", error);
    return null;
  }
}

// Função para carregar perfil do usuário na interface
async function loadUserProfile() {
  const userInfo = await getUserInfo();

  if (userInfo) {
    // Atualizar elementos com classe .user-name
    const userNameElements = document.querySelectorAll(".user-name");
    userNameElements.forEach((element) => {
      element.textContent = userInfo.nome || userInfo.email;
    });

    // Atualizar elementos com classe .user-email
    const userEmailElements = document.querySelectorAll(".user-email");
    userEmailElements.forEach((element) => {
      element.textContent = userInfo.email;
    });

    // Salvar role no localStorage
    localStorage.setItem("userRole", userInfo.role || "user");

    console.log("👤 Perfil carregado:", userInfo.email);
  }
}

// Função para adicionar menu do usuário
function addUserMenu() {
  // Verificar se já existe
  if (document.querySelector(".user-menu")) return;

  const header = document.querySelector(".header .container");
  if (!header) return;

  // Criar menu do usuário
  const userMenuHTML = `
        <div class="user-menu">
            <div class="user-info" onclick="toggleUserMenu()">
                <i class="fas fa-user-circle"></i>
                <span class="user-name">Usuário</span>
            </div>
            <div class="user-dropdown" id="userDropdown">
                <div class="user-dropdown-content">
                    <div class="user-details">
                        <strong class="user-name">Usuário</strong>
                        <small class="user-email">email@exemplo.com</small>
                    </div>
                    <hr>
                    <a href="#" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i> Sair
                    </a>
                </div>
            </div>
        </div>
    `;

  header.insertAdjacentHTML("beforeend", userMenuHTML);

  // Adicionar estilos
  if (!document.querySelector("#user-menu-styles")) {
    const style = document.createElement("style");
    style.id = "user-menu-styles";
    style.textContent = `
            .user-menu {
                position: relative;
                margin-left: auto;
            }
            
            .user-info {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: rgba(255,255,255,0.1);
                border-radius: 20px;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .user-info:hover {
                background: rgba(255,255,255,0.2);
            }
            
            .user-info i {
                font-size: 24px;
                color: white;
            }
            
            .user-name {
                color: white;
                font-weight: 600;
                max-width: 150px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .user-dropdown {
                display: none;
                position: absolute;
                right: 0;
                top: 100%;
                min-width: 200px;
                background: white;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                border-radius: 5px;
                z-index: 1000;
                margin-top: 5px;
            }
            
            .user-dropdown.show {
                display: block;
            }
            
            .user-dropdown-content {
                padding: 15px;
            }
            
            .user-details {
                padding: 10px 0;
            }
            
            .user-details small {
                color: #666;
                font-size: 12px;
            }
            
            .user-dropdown hr {
                margin: 10px 0;
                border: none;
                border-top: 1px solid #eee;
            }
            
            .user-dropdown a {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                color: #333;
                text-decoration: none;
                border-radius: 3px;
                transition: background 0.3s;
            }
            
            .user-dropdown a:hover {
                background: #f5f5f5;
            }
            
            @media (max-width: 768px) {
                .user-name {
                    display: none;
                }
            }
        `;
    document.head.appendChild(style);
  }

  // Carregar informações do usuário
  loadUserProfile();
}

// Função para mostrar/esconder menu do usuário
function toggleUserMenu() {
  const dropdown = document.getElementById("userDropdown");
  if (dropdown) {
    dropdown.classList.toggle("show");
  }
}

// Fechar menu ao clicar fora
document.addEventListener("click", function (event) {
  const dropdown = document.getElementById("userDropdown");
  const userInfo = document.querySelector(".user-info");

  if (
    dropdown &&
    userInfo &&
    !userInfo.contains(event.target) &&
    !dropdown.contains(event.target)
  ) {
    dropdown.classList.remove("show");
  }
});

// Inicialização
document.addEventListener("DOMContentLoaded", function () {
  console.log("🔐 Auth.js carregado");

  // Verificar login em todas as páginas (exceto login.html)
  const isLoginPage = window.location.pathname.includes("login.html");
  const isPrintPage = window.location.pathname.includes("imprimir.html");

  if (!isLoginPage && !isPrintPage) {
    // Aguardar Firebase estar pronto
    const checkFirebase = setInterval(() => {
      if (verificarFirebase()) {
        clearInterval(checkFirebase);

        // Verificar autenticação
        setTimeout(() => {
          if (!verificarLogin()) {
            console.log("Redirecionando para login...");
            window.location.href = "login.html";
          } else {
            // Adicionar menu do usuário
            setTimeout(addUserMenu, 500);
          }
        }, 1000);
      }
    }, 100);
  }
});

// Adicionar botão de logout simples no rodapé
function addLogoutButton() {
  const footer = document.querySelector(".footer .container");
  if (footer && !footer.querySelector(".logout-btn")) {
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn btn-small btn-secondary logout-btn";
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
    logoutBtn.onclick = logout;
    logoutBtn.style.marginTop = "10px";
    footer.appendChild(logoutBtn);
  }
}

// Exportar funções para uso global
window.verificarLogin = verificarLogin;
window.logout = logout;
window.getUserInfo = getUserInfo;
window.loadUserProfile = loadUserProfile;
window.addUserMenu = addUserMenu;
window.toggleUserMenu = toggleUserMenu;
window.addLogoutButton = addLogoutButton;
