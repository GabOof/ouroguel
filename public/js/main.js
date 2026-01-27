// main.js - Funcionalidades gerais do sistema

// Função para formatar data
function formatarData(data) {
  if (!data) return "";

  const dataObj = data.toDate ? data.toDate() : new Date(data);
  return dataObj.toLocaleDateString("pt-BR");
}

// Função para formatar moeda
function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

// Função para mostrar mensagem de sucesso
function mostrarMensagem(titulo, mensagem, tipo = "success") {
  // Remove mensagens anteriores
  const mensagensAntigas = document.querySelectorAll(".alert-flutuante");
  mensagensAntigas.forEach((msg) => msg.remove());

  // Cria nova mensagem
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${tipo} alert-flutuante`;
  alertDiv.innerHTML = `
        <i class="fas fa-${tipo === "success" ? "check-circle" : "exclamation-circle"}"></i>
        <div>
            <strong>${titulo}</strong>
            <p>${mensagem}</p>
        </div>
        <button onclick="this.parentElement.remove()" style="background:none; border:none; cursor:pointer;">
            <i class="fas fa-times"></i>
        </button>
    `;

  // Estilo para mensagem flutuante
  alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;

  // Adiciona ao corpo
  document.body.appendChild(alertDiv);

  // Remove automaticamente após 5 segundos
  setTimeout(() => {
    if (alertDiv.parentElement) {
      alertDiv.remove();
    }
  }, 5000);
}

// Adiciona estilo CSS para animação
if (!document.querySelector("#alert-styles")) {
  const style = document.createElement("style");
  style.id = "alert-styles";
  style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .alert-flutuante {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
    `;
  document.head.appendChild(style);
}

// Função para carregar clientes (usada em várias páginas)
async function carregarClientesParaSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    // Limpa opções existentes (exceto a primeira)
    while (select.options.length > 1) {
      select.remove(1);
    }

    // Busca clientes no Firestore
    const snapshot = await db.collection("clientes").get();

    if (snapshot.empty) {
      console.log("Nenhum cliente encontrado");
      return;
    }

    // Adiciona cada cliente como opção
    snapshot.forEach((doc) => {
      const cliente = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = `${cliente.nome} - ${cliente.cpf || ""}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
    mostrarMensagem("Erro", "Não foi possível carregar os clientes", "error");
  }
}

// Função para carregar equipamentos (usada em várias páginas)
async function carregarEquipamentosParaSelect(
  selectId,
  apenasDisponiveis = true,
) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    // Limpa opções existentes (exceto a primeira)
    while (select.options.length > 1) {
      select.remove(1);
    }

    // Cria query
    let query = db.collection("equipamentos");
    if (apenasDisponiveis) {
      query = query.where("status", "==", "disponivel");
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log("Nenhum equipamento encontrado");
      return;
    }

    // Adiciona cada equipamento como opção
    snapshot.forEach((doc) => {
      const equipamento = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = `${equipamento.nomeEquipamento} (${equipamento.quantidadeDisponivel || 0} disp.)`;
      option.dataset.equipamento = JSON.stringify(equipamento);
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar equipamentos:", error);
    mostrarMensagem(
      "Erro",
      "Não foi possível carregar os equipamentos",
      "error",
    );
  }
}

// Função para buscar informações de um cliente
async function buscarClientePorId(clienteId) {
  try {
    const doc = await db.collection("clientes").doc(clienteId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar cliente:", error);
    return null;
  }
}

// Função para buscar informações de um equipamento
async function buscarEquipamentoPorId(equipamentoId) {
  try {
    const doc = await db.collection("equipamentos").doc(equipamentoId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar equipamento:", error);
    return null;
  }
}

// Função para validar CPF/CNPJ
function validarCPFCNPJ(valor) {
  // Remove caracteres não numéricos
  const limpo = valor.replace(/\D/g, "");

  // Valida CPF (11 dígitos)
  if (limpo.length === 11) {
    return validarCPF(limpo);
  }

  // Valida CNPJ (14 dígitos)
  if (limpo.length === 14) {
    return validarCNPJ(limpo);
  }

  return false;
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, "");

  if (cpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) return false;

  // Validação dos dígitos verificadores
  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, "");

  if (cnpj.length !== 14) return false;

  // Validação dos dígitos verificadores
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
}

// Função para formatar CPF/CNPJ
function formatarCPFCNPJ(valor) {
  const limpo = valor.replace(/\D/g, "");

  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (limpo.length === 14) {
    return limpo.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }

  return valor;
}

// Função para formatar telefone
function formatarTelefone(valor) {
  const limpo = valor.replace(/\D/g, "");

  if (limpo.length === 10) {
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  if (limpo.length === 11) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  return valor;
}

// Inicialização quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", function () {
  console.log("Sistema Ouroguel - Carregado");

  // Configura data atual nos campos de data
  const dataAtual = new Date().toISOString().split("T")[0];
  const camposData = document.querySelectorAll('input[type="date"]');
  camposData.forEach((campo) => {
    if (!campo.value) {
      campo.value = dataAtual;
    }
    // Garante que o campo é grande o suficiente
    campo.style.fontSize = "18px";
    campo.style.padding = "12px";
  });

  // Adiciona máscaras aos campos
  const camposCPF = document.querySelectorAll(
    'input[placeholder*="CPF"], input[placeholder*="cnpj"]',
  );
  camposCPF.forEach((campo) => {
    campo.addEventListener("input", function (e) {
      let valor = e.target.value;
      const limpo = valor.replace(/\D/g, "");

      if (limpo.length <= 11) {
        valor = limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      } else {
        valor = limpo.replace(
          /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
          "$1.$2.$3/$4-$5",
        );
      }

      e.target.value = valor.substring(0, 18);
    });
  });

  const camposTelefone = document.querySelectorAll(
    'input[type="tel"], input[placeholder*="telefone"], input[placeholder*="celular"]',
  );
  camposTelefone.forEach((campo) => {
    campo.addEventListener("input", function (e) {
      let valor = e.target.value.replace(/\D/g, "");

      if (valor.length <= 10) {
        valor = valor.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
      } else {
        valor = valor.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
      }

      e.target.value = valor.substring(0, 15);
    });
  });

  // Adiciona estilo de foco melhorado para acessibilidade
  const todosInputs = document.querySelectorAll(
    "input, select, textarea, button",
  );
  todosInputs.forEach((elemento) => {
    elemento.addEventListener("focus", function () {
      this.style.outline = "3px solid #3498db";
      this.style.outlineOffset = "2px";
    });

    elemento.addEventListener("blur", function () {
      this.style.outline = "";
      this.style.outlineOffset = "";
    });
  });
});
