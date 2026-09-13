export const $ = (id) => document.getElementById(id);

export function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]);
}

export function cleanError(message) {
  return String(message || 'Erro inesperado')
    .replace(/^.*?:\s*/, '')
    .replace(/CONTEXT:[\s\S]*$/, '')
    .trim();
}

export function setButtonBusy(button, busy, label = 'Carregando') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.old) button.dataset.old = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="loader"></span>${label}`;
    return;
  }
  button.disabled = false;
  if (button.dataset.old) {
    button.innerHTML = button.dataset.old;
    delete button.dataset.old;
  }
}

export function roomGoneError(message) {
  return /não pertence|expirou|não encontrada|encerrada/i.test(String(message || ''));
}
