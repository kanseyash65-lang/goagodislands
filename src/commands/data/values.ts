import type { Behavior, Mood } from '../../types/behavior';
import type { WeatherKind } from '../../types/weather';
import type { ComicEffect, MetaAction, TimeValue } from '../types';

/** Value tables: sizes, speeds, moods, behaviours, weather, times (05 §7). */
export const SIZE_TABLE: readonly [string, number, boolean][] = [
  ['tiny', 0.4, false], ['small', 0.7, false], ['mini', 0.5, false], ['microscopic', 0.25, false],
  ['teeny', 0.35, false], ['itty bitty', 0.3, false], ['big', 1.5, false], ['large', 1.5, false], ['giant', 2.5, false],
  ['huge', 3.5, false], ['massive', 5, false], ['enormous', 4, false], ['gigantic', 4, false], ['colossal', 5, false],
  ['titanic', 5, false], ['humongous', 4.5, false], ['jumbo', 2.5, false], ['normal size', 1, false], ['normal sized', 1, false],
  ['regular size', 1, false], ['bigger', 1.6, true], ['larger', 1.6, true], ['smaller', 0.6, true], ['twice as big', 2, true],
  ['double size', 2, true], ['double the size', 2, true], ['half size', 0.5, true], ['half the size', 0.5, true],
  ['tall', 1.6, false], ['taller', 1.4, true], ['short', 0.7, false], ['shorter', 0.75, true], ['fat', 1.4, false], ['chonky', 1.6, false],
];

export const SPEED_TABLE: readonly [string, number, boolean][] = [
  ['fast', 2, false], ['quick', 2, false], ['speedy', 2, false], ['rapid', 2.2, false], ['super fast', 4, false],
  ['really fast', 3.2, false], ['lightning fast', 5, false], ['faster', 1.8, true], ['quicker', 1.8, true],
  ['slow', 0.5, false], ['sluggish', 0.3, false], ['slower', 0.55, true], ['super slow', 0.2, false],
  ['normal speed', 1, false], ['zoomy', 3, false],
];

export const MOOD_TABLE: readonly [string, Mood][] = [
  ['happy', 'happy'], ['joyful', 'happy'], ['cheerful', 'happy'], ['glad', 'happy'], ['content', 'happy'],
  ['sad', 'sad'], ['unhappy', 'sad'], ['depressed', 'sad'], ['gloomy', 'sad'], ['grumpy', 'angry'], ['angry', 'angry'],
  ['mad', 'angry'], ['furious', 'angry'], ['scared', 'scared'], ['afraid', 'scared'], ['terrified', 'scared'],
  ['frightened', 'scared'], ['excited', 'excited'], ['hyped', 'excited'], ['thrilled', 'excited'], ['confused', 'confused'],
  ['puzzled', 'confused'], ['inspired', 'inspired'], ['motivated', 'inspired'], ['sleepy', 'sleepy'], ['tired', 'sleepy'],
  ['resigned', 'resigned'], ['bored', 'resigned'], ['calm', 'neutral'], ['normal', 'neutral'],
];

export const BEHAVIOR_TABLE: readonly [string, Behavior][] = [
  ['dance', 'dance'], ['dancing', 'dance'], ['boogie', 'dance'], ['party', 'dance'], ['partying', 'dance'], ['disco dance', 'dance'],
  ['panic', 'panic'], ['panicking', 'panic'], ['scream', 'panic'], ['screaming', 'panic'], ['freak out', 'panic'],
  ['sleep', 'sleep'], ['sleeping', 'sleep'], ['nap', 'sleep'], ['napping', 'sleep'], ['go to sleep', 'sleep'], ['go to bed', 'sleep'],
  ['celebrate', 'celebrate'], ['celebrating', 'celebrate'], ['cheer', 'celebrate'], ['cheering', 'celebrate'],
  ['pray', 'pray'], ['praying', 'pray'], ['sing', 'sing'], ['singing', 'sing'], ['work', 'work'], ['working', 'work'],
  ['run', 'run'], ['running', 'run'], ['flee', 'run'], ['jump', 'jump'], ['jumping', 'jump'], ['hop', 'jump'], ['bounce', 'jump'],
  ['spin', 'spin'], ['spinning', 'spin'], ['twirl', 'spin'], ['float', 'float'], ['floating', 'float'], ['fly', 'float'], ['levitate', 'float'],
  ['calm down', 'calm'], ['relax', 'calm'], ['chill', 'calm'], ['fight', 'fight'], ['fighting', 'fight'],
];

export const WEATHER_TABLE: readonly [string, WeatherKind][] = [
  ['rain', 'rain'], ['rainy', 'rain'], ['raining', 'rain'], ['rainstorm', 'storm'], ['drizzle', 'rain'], ['shower', 'rain'], ['showers', 'rain'],
  ['storm', 'storm'], ['stormy', 'storm'], ['thunderstorm', 'storm'], ['thunder', 'storm'], ['lightning storm', 'storm'],
  ['snow', 'snow'], ['snowy', 'snow'], ['snowing', 'snow'], ['blizzard', 'snow'], ['snowstorm', 'snow'],
  ['fog', 'fog'], ['foggy', 'fog'], ['mist', 'fog'], ['misty', 'fog'], ['clear', 'clear'], ['sunny', 'clear'],
  ['nice weather', 'clear'], ['good weather', 'clear'], ['clear skies', 'clear'], ['clear sky', 'clear'], ['drought', 'clear'],
  ['cloudy', 'cloudy'], ['overcast', 'cloudy'], ['windy', 'windy'], ['wind', 'windy'], ['breezy', 'windy'], ['hurricane', 'storm'],
  ['hail', 'hail'], ['hailstorm', 'hail'],
];

const at = (minutes: number, label: string): TimeValue => ({ kind: 'set', minutes, label });
export const TIME_TABLE: readonly [string, TimeValue][] = [
  ['night', at(22 * 60, 'night')], ['nighttime', at(22 * 60, 'night')], ['midnight', at(0, 'midnight')],
  ['dawn', at(6 * 60 + 30, 'dawn')], ['sunrise', at(6 * 60 + 30, 'dawn')], ['morning', at(8 * 60, 'morning')],
  ['noon', at(12 * 60, 'noon')], ['midday', at(12 * 60, 'noon')], ['afternoon', at(15 * 60, 'afternoon')],
  ['evening', at(18 * 60 + 30, 'evening')], ['sunset', at(19 * 60, 'sunset')], ['dusk', at(19 * 60 + 30, 'dusk')],
  ['day', at(11 * 60, 'day')], ['daytime', at(11 * 60, 'day')], ['golden hour', at(18 * 60 + 40, 'golden hour')],
  ['friday', { kind: 'friday' }], ['saturday', { kind: 'friday' }], ['weekend', { kind: 'friday' }], ['monday', { kind: 'friday' }],
];

export const COMIC_EFFECTS: readonly ComicEffect[] = ['float', 'spin', 'bounce', 'glow', 'grow', 'shrink', 'dance', 'recolor', 'vanish'];

/** Meta phrases matched at the start of a sentence (05 §12). `args` = text after the phrase is an argument. */
export const META_TABLE: readonly [string, MetaAction, boolean][] = [
  ['undo', 'undo', false], ['undo that', 'undo', false], ['redo', 'redo', false], ['rewind', 'rewind', true],
  ['remember this as', 'remember', true], ['remember that as', 'remember', true], ['save this as', 'remember', true],
  ['save this as spell', 'remember', true], ['remember as', 'remember', true], ['cast', 'cast', true], ['spellbook', 'spellbook', false],
  ['newspaper', 'newspaper', false], ['show the newspaper', 'newspaper', false], ['show newspaper', 'newspaper', false],
  ['show me the newspaper', 'newspaper', false], ['front page', 'newspaper', false], ['show the front page', 'newspaper', false],
  ['headlines', 'newspaper', false], ['news', 'newspaper', false], ['daily tuesday', 'newspaper', false], ['the daily tuesday', 'newspaper', false],
  ['read the news', 'newspaper', false], ['close', 'close', false], ['close that', 'close', false], ['close the newspaper', 'close', false],
  ['hide the newspaper', 'close', false], ['close newspaper', 'close', false], ['skip the intro', 'close', false], ['skip intro', 'close', false],
  ['chronicle', 'chronicle', false], ['history', 'chronicle', false], ['help', 'help', false], ['what can i say', 'help', false],
  ['what can i do', 'help', false], ['commands', 'help', false], ['demo', 'demo', false], ['demo mode', 'demo', false],
  ['pause', 'pause', false], ['pause the game', 'pause', false], ['pause game', 'pause', false], ['unpause', 'pause', false],
  ['resume the game', 'pause', false], ['mute', 'mute', false], ['unmute', 'mute', false], ['be quiet', 'mute', false], ['reset', 'reset', false],
  ['reset world', 'reset', false], ['reset the world', 'reset', false], ['new world', 'reset', false], ['start over', 'reset', false],
  ['photo mode', 'photo', false], ['take a photo', 'photo', false], ['screenshot', 'photo', false], ['debug', 'debug', false],
  ['show debug', 'debug', false], ['stats', 'debug', false], ['again', 'repeat', false], ['do that again', 'repeat', false],
  ['do it again', 'repeat', false], ['repeat', 'repeat', false], ['repeat that', 'repeat', false], ['one more time', 'repeat', false],
  ['once more', 'repeat', false], ['more', 'more', false], ['even more', 'more', false], ['more of that', 'more', false],
];
