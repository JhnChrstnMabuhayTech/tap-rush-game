// An on/off switch row for settings: the label, its state as a word, and a
// track. The kit has no switch, so it's built from the tokens (styles.css,
// gc-switch). The state is never colour alone: the knob moves and the word
// changes too.

export function settingSwitch(
  label: string,
  on: boolean,
  onChange: (on: boolean) => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gc-switch';
  button.setAttribute('role', 'switch');
  const name = document.createElement('span');
  name.className = 'gc-switch-label';
  name.textContent = label;
  const state = document.createElement('span');
  state.className = 'gc-switch-state';
  const track = document.createElement('span');
  track.className = 'gc-switch-track';
  track.setAttribute('aria-hidden', 'true');
  track.append(document.createElement('i'));
  button.append(name, state, track);

  const show = (value: boolean) => {
    button.setAttribute('aria-checked', String(value));
    state.textContent = value ? 'On' : 'Off';
  };
  show(on);
  button.addEventListener('click', () => {
    const next = button.getAttribute('aria-checked') !== 'true';
    show(next);
    onChange(next);
  });
  return button;
}
