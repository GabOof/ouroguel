// Verificar se usuário está logado
function verificarLogin() {
  const user = auth.currentUser;

  if (!user) {
    // Redirecionar para login se não estiver logado
    if (!window.location.href.includes("login.html")) {
      window.location.href = "login.html";
    }
    return false;
  }

  return true;
}

// Obter informações do usuário logado
async function getUserInfo() {
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
      nome: user.displayName || "Usuário",
      role: "user",
    };
  } catch (error) {
    console.error("Erro ao obter informações do usuário:", error);
    return null;
  }
}

// Verificar permissões do usuário
function checkPermission(requiredRole = "user") {
  const userRole = localStorage.getItem("userRole") || "user";
  const roles = ["user", "admin"]; // Ordem de permissão

  const requiredIndex = roles.indexOf(requiredRole);
  const userIndex = roles.indexOf(userRole);

  return userIndex >= requiredIndex;
}

// Logout do sistema
function logout() {
  if (confirm("Deseja sair do sistema?")) {
    auth
      .signOut()
      .then(() => {
        localStorage.clear();
        window.location.href = "login.html";
      })
      .catch((error) => {
        console.error("Erro ao fazer logout:", error);
        alert("Erro ao sair do sistema: " + error.message);
      });
  }
}

// Carregar informações do usuário na interface
async function loadUserProfile() {
  const userInfo = await getUserInfo();

  if (userInfo) {
    // Atualizar elementos na interface
    const userElements = document.querySelectorAll(
      ".user-name, .user-email, .user-role",
    );

    userElements.forEach((element) => {
      if (element.classList.contains("user-name")) {
        element.textContent = userInfo.nome || userInfo.email;
      }
      if (element.classList.contains("user-email")) {
        element.textContent = userInfo.email;
      }
      if (element.classList.contains("user-role")) {
        element.textContent =
          userInfo.role === "admin" ? "Administrador" : "Usuário";
      }
    });

    // Salvar role no localStorage
    localStorage.setItem("userRole", userInfo.role);

    // Esconder/mostrar elementos baseado na role
    if (userInfo.role !== "admin") {
      const adminOnlyElements = document.querySelectorAll(".admin-only");
      adminOnlyElements.forEach((el) => (el.style.display = "none"));
    }
  }
}

// Adicionar menu de usuário em todas as páginas
function addUserMenu() {
  // Verificar se já existe menu
  if (document.querySelector(".user-menu")) return;

  // Encontrar o header
  const header = document.querySelector(".header .container");

  if (header) {
    const userMenuHTML = `
            <div class="user-menu">
                <div class="user-info">
                    <i class="fas fa-user-circle"></i>
                    <span class="user-name">Carregando...</span>
                </div>
                <div class="user-dropdown">
                    <a href="#"><i class="fas fa-user"></i> Meu Perfil</a>
                    <a href="#" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Sair</a>
                </div>
            </div>
        `;

    // Adicionar ao header
    header.insertAdjacentHTML("beforeend", userMenuHTML);

    // Carregar informações do usuário
    loadUserProfile();

    // Adicionar estilos
    if (!document.querySelector("#user-menu-styles")) {
      const styles = document.createElement("style");
      styles.id = "user-menu-styles";
      styles.textContent = `
                .user-menu {
                    position: relative;
                    margin-left: auto;
                }
                
                .user-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    padding: 10px;
                    border-radius: 5px;
                    transition: background-color 0.3s;
                }
                
                .user-info:hover {
                    background-color: rgba(255,255,255,0.1);
                }
                
                .user-info i {
                    font-size: 1.5rem;
                }
                
                .user-name {
                    font-weight: 600;
                    color: white;
                    max-width: 150px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .user-dropdown {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    background: white;
                    min-width: 200px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                    border-radius: 5px;
                    display: none;
                    z-index: 1000;
                }
                
                .user-menu:hover .user-dropdown {
                    display: block;
                }
                
                .user-dropdown a {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 15px;
                    color: #333;
                    text-decoration: none;
                    transition: background-color 0.3s;
                    border-bottom: 1px solid #eee;
                }
                
                .user-dropdown a:last-child {
                    border-bottom: none;
                }
                
                .user-dropdown a:hover {
                    background-color: #f5f5f5;
                }
                
                @media (max-width: 768px) {
                    .user-name {
                        display: none;
                    }
                    
                    .user-dropdown {
                        position: fixed;
                        top: auto;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        width: 100%;
                        border-radius: 10px 10px 0 0;
                    }
                }
            `;
      document.head.appendChild(styles);
    }
  }
}

// Proteger páginas (executar em todas as páginas, exceto login)
if (
  !window.location.href.includes("login.html") &&
  !window.location.href.includes("imprimir.html")
) {
  document.addEventListener("DOMContentLoaded", function () {
    // Verificar autenticação
    verificarLogin();

    // Adicionar menu de usuário
    setTimeout(addUserMenu, 100);

    // Adicionar botão de logout no rodapé (alternativo)
    const footer = document.querySelector(".footer .container");
    if (footer) {
      const logoutBtn = document.createElement("button");
      logoutBtn.className = "btn btn-small btn-secondary";
      logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
      logoutBtn.onclick = logout;
      logoutBtn.style.marginTop = "10px";
      footer.appendChild(logoutBtn);
    }
  });
}
