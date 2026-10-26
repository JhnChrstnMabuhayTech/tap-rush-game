import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('index.html has no #app element');

app.textContent = 'Glowcatch';
