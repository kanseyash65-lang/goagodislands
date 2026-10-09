export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'windy' | 'hail';

export const WEATHER_LABEL: Readonly<Record<WeatherKind, string>> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  rain: 'Rain',
  storm: 'Storm',
  snow: 'Snow',
  fog: 'Fog',
  windy: 'Windy',
  hail: 'Hail',
};

export const WEATHER_ICON: Readonly<Record<WeatherKind, string>> = {
  clear: '☀',
  cloudy: '☁',
  rain: '🌧',
  storm: '⛈',
  snow: '❄',
  fog: '🌫',
  windy: '🌬',
  hail: '🧊',
};
