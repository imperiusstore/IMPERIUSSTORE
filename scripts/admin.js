const sessionKey = 'imperiusSession';

const stats = {
  revenue: { value: 'R$ 184.200', trend: '+12% vs. mês anterior' },
  orders: { value: '1.249', trend: '+4% em 7 dias' },
  customers: { value: '842', trend: '+18 novos' },
  delivery: { value: '96%', trend: 'tempo médio 1,4 dias' },
};

const orders = [
  { client: 'Alice Souza', order: '#1029', status: 'Pago', value: 'R$ 829,90', updated: 'há 3 min' },
  { client: 'Lucas Ferreira', order: '#1028', status: 'Em separação', value: 'R$ 539,40', updated: 'há 12 min' },
  { client: 'Marina Prado', order: '#1027', status: 'Enviado', value: 'R$ 1.249,00', updated: 'há 20 min' },
  { client: 'Carlos Silva', order: '#1026', status: 'Aguardando pagamento', value: 'R$ 312,70', updated: 'há 33 min' },
];

const actions = [
  { title: 'Criar cupom de desconto', description: 'Incentive conversões com um voucher temporário.' },
  { title: 'Publicar nova coleção', description: 'Suba produtos e banners em poucos cliques.' },
  { title: 'Exportar relatórios', description: 'Gere CSV com pedidos, estoque e finanças.' },
  { title: 'Gerenciar usuários', description: 'Conceda ou remova acessos administrativos.' },
];

function requireSession() {
  const raw = sessionStorage.getItem(sessionKey);

  if (!raw) {
    window.location.replace('login.html');
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    window.location.replace('login.html');
    return null;
  }
}

function populateStats() {
  document.getElementById('stat-revenue').textContent = stats.revenue.value;
  document.getElementById('stat-orders').textContent = stats.orders.value;
  document.getElementById('stat-customers').textContent = stats.customers.value;
  document.getElementById('stat-delivery').textContent = stats.delivery.value;

  document.getElementById('stat-revenue-trend').textContent = stats.revenue.trend;
  document.getElementById('stat-orders-trend').textContent = stats.orders.trend;
  document.getElementById('stat-customers-trend').textContent = stats.customers.trend;
  document.getElementById('stat-delivery-trend').textContent = stats.delivery.trend;
}

function statusClass(status) {
  const normalized = status.toLowerCase();
  if (normalized.includes('pago') || normalized.includes('enviado')) return 'success';
  if (normalized.includes('aguardando') || normalized.includes('separa')) return 'warning';
  return 'danger';
}

function populateOrders() {
  const tbody = document.getElementById('orders-table');

  tbody.innerHTML = '';
  orders.forEach((order) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${order.client}</td>
      <td>${order.order}</td>
      <td><span class="status ${statusClass(order.status)}">${order.status}</span></td>
      <td>${order.value}</td>
      <td>${order.updated}</td>
    `;
    tbody.appendChild(tr);
  });
}

function populateActions() {
  const wrapper = document.getElementById('actions-list');
  wrapper.innerHTML = '';

  actions.forEach((action) => {
    const div = document.createElement('div');
    div.className = 'action-item';
    div.innerHTML = `
      <strong>${action.title}</strong>
      <p>${action.description}</p>
      <button class="button-ghost">Executar</button>
    `;
    wrapper.appendChild(div);
  });
}

function wireLogout() {
  const button = document.getElementById('logout');
  if (!button) return;

  button.addEventListener('click', () => {
    sessionStorage.removeItem(sessionKey);
    window.location.replace('login.html');
  });
}

function setUserMeta(session) {
  const target = document.getElementById('user-meta');
  if (!target) return;

  const date = new Date(session.loggedAt);
  const formatted = date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  target.textContent = `${session.email} • logado em ${formatted}`;
}

function init() {
  const session = requireSession();
  if (!session) return;

  setUserMeta(session);
  populateStats();
  populateOrders();
  populateActions();
  wireLogout();
}

document.addEventListener('DOMContentLoaded', init);
