import { detectPlatform } from './platform/platform';
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

boot().catch((error: unknown) => console.error('Glowcatch failed to start', error));

async function boot() {
  const platform = detectPlatform();
  await platform.initialize();
  platform.setLoadingProgress(50);

  // The title animates in its display face, so wait for it, but never for long.
  await Promise.race([document.fonts.load('800 64px "Bricolage Grotesque"'), delay(1500)]).catch(
    () => {},
  );
  platform.setLoadingProgress(100);

  await platform.start();
  showTitle();
}

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

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
