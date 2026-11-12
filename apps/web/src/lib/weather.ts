import type { ForecastDayDto } from './api-types';

export type Condition = 'heavy' | 'showers' | 'cloudy' | 'clear';

/** Sky condition for a day, as the legacy weather table described it. */
export const condition = (d: Pick<ForecastDayDto, 'rain' | 'rp'>): Condition =>
  d.rain > 15 ? 'heavy' : d.rain > 0 ? 'showers' : d.rp > 45 ? 'cloudy' : 'clear';
