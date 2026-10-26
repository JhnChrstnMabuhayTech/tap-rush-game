import './styles.css';
import { kit } from './ui/kit';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('index.html has no #app element');
const root = app;

// Desktop gets the design's 9:16 frame, letterboxed; phones, and windows
// narrower than 9:16, use the whole screen.
const desktop = window.matchMedia(
  '(hover: hover) and (pointer: fine) and (min-aspect-ratio: 9/16)',
);
const fitFrame = () => root.classList.toggle('gc-letterbox', desktop.matches);
desktop.addEventListener('change', fitFrame);
fitFrame();

showTitle();

function showTitle() {
  const field = kit.PlayField({ ambient: true });
  const title = kit.TitleScreen({ onPlay: () => showRound(field) });
  title.classList.add('screen');
  field.append(title);
  root.replaceChildren(field);
}

// Placeholder until the game loop lands (roadmap Phase 2): Play runs the UI
// kit's reference round, so a build can be smoke-tested on Facebook now.
function showRound(title: ReturnType<typeof kit.PlayField>) {
  title.stop();
  root.replaceChildren(kit.PlayField());
}
