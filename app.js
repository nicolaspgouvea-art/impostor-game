import { boot } from '#controller';

boot().catch((error) => {
  console.error('Impostor Game boot failed:', error);
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = 'Não foi possível iniciar o jogo. Atualize a página.';
    toast.classList.add('show');
  }
});
