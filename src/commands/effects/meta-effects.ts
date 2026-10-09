import { result, type Effect } from '../executor/effect-services';
import { focusOf, resolveTargets } from '../executor/target-query';

const NOT_YET: Readonly<Record<string, string>> = {
  undo: 'undo', redo: 'redo', rewind: 'rewind', remember: 'remember spells', cast: 'cast spells', spellbook: 'open the spellbook',
  chronicle: 'read the full chronicle', reset: 'reset the world', photo: 'take photos',
};

/** Camera moves: zoom, overview, focus on a target or place. */
export const cameraEffect: Effect = {
  run(cmd, s) {
    const action = cmd.value?.type === 'camera' ? cmd.value.action : 'overview';
    if (action !== 'focus') {
      s.bus.emit('CameraRequested', { action, x: s.view.centerX, y: s.view.centerY });
      return result(action === 'overview' ? 'Bird\'s eye view.' : action === 'zoom-in' ? 'Closer.' : 'Further.', { reaction: 'none' });
    }
    const t = cmd.target;
    if (t.type === 'tag' && t.tag.startsWith('@')) {
      const a = s.layout.anchors[t.tag.slice(1)];
      if (a) {
        s.bus.emit('CameraRequested', { action: 'focus', x: a.x, y: a.y });
        return result(`Looking at the ${t.label}.`, { focus: a, reaction: 'none' });
      }
    }
    const ids = resolveTargets(t, s, cmd);
    const f = focusOf(ids, s);
    if (!f) return result(`Reality could not find ${t.type === 'none' ? 'that' : t.label}.`, { reaction: 'none' });
    s.bus.emit('CameraRequested', { action: 'focus', x: f.x, y: f.y });
    return result(`Looking at ${t.type === 'none' ? 'that' : t.label}.`, { focus: f, reaction: 'none' });
  },
};

/** Meta commands. Features from later milestones answer politely, in-universe. */
export const metaEffect: Effect = {
  run(cmd, s) {
    const action = cmd.value?.type === 'meta' ? cmd.value.action : 'help';
    switch (action) {
      case 'newspaper':
        s.bus.emit('NewspaperRequested', {});
        return result('The Daily Tuesday, hot off the press.', { reaction: 'none' });
      case 'close':
        s.bus.emit('NewspaperClosed', {});
        return result('Closed.', { reaction: 'none' });
      case 'help':
        s.bus.emit('HelpRequested', {});
        return result('Reality is listening. Try one of the suggestions below.', { reaction: 'none' });
      case 'pause':
        s.bus.emit('UiAction', { action: 'pause' });
        return result('Time holds its breath.', { reaction: 'none' });
      case 'demo':
        s.bus.emit('UiAction', { action: 'demo' });
        return result('Watch the god at work.', { reaction: 'none' });
      case 'mute':
        s.bus.emit('UiAction', { action: 'mute' });
        return result('Toggled the sound.', { reaction: 'none' });
      case 'debug':
        s.bus.emit('DebugToggled', {});
        return result('Debug overlay toggled.', { reaction: 'none' });
      default: {
        const what = NOT_YET[action] ?? action;
        const text = `Reality noted your request to ${what}. That power arrives on a later Tuesday.`;
        s.bus.emit('ToastRequested', { text });
        return result(text, { reaction: 'none' });
      }
    }
  },
};
