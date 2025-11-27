const demoCredentials = {
  email: 'admin@imperius.store',
  password: 'Admin@123',
};

function setFeedback(message, type = 'error') {
  const feedback = document.getElementById('feedback');

  feedback.className = `alert ${type}`;
  feedback.textContent = message;
}

function persistSession(email) {
  const payload = {
    email,
    loggedAt: new Date().toISOString(),
  };

  sessionStorage.setItem('imperiusSession', JSON.stringify(payload));
}

function handleSubmit(event) {
  event.preventDefault();

  const email = /** @type {HTMLInputElement} */ (document.getElementById('email')).value.trim();
  const password = /** @type {HTMLInputElement} */ (document.getElementById('password')).value.trim();

  if (email === demoCredentials.email && password === demoCredentials.password) {
    persistSession(email);
    setFeedback('Login realizado! Redirecionando para o painel...', 'success');
    setTimeout(() => window.location.assign('admin.html'), 600);
  } else {
    setFeedback('Credenciais inválidas. Confira o e-mail e a senha informados.');
  }
}

function init() {
  const form = document.getElementById('login-form');

  if (!form) return;
  form.addEventListener('submit', handleSubmit);
}

document.addEventListener('DOMContentLoaded', init);
