import { isDefined } from 'simple-bool';

export function getUTCDate(): Date;
export function getUTCDate(year: number, monthIndex: number, day: number): Date;
export function getUTCDate(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): Date;
export function getUTCDate(
  year?: number,
  monthIndex?: number,
  day?: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0,
  millisecond: number = 0,
): Date {
  if (!isDefined(year) && !isDefined(monthIndex) && !isDefined(day)) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + now.getTimezoneOffset());
    return now;
  }
  return new Date(
    Date.UTC(year!, monthIndex, day, hour, minute, second, millisecond),
  );
}

export function coerceDateProperty<T>(v: any, fallback: T): Date | T {
  if (typeof v == 'string') {
    if (v.toLowerCase() === 'now') {
      return new Date();
    }
  }
  v = new Date(v);
  if (isNaN(v.valueOf())) {
    return fallback;
  }
  return v;
}

export function coerceDateOnlyProperty<T>(
  v: any,
  fallback: T,
  asUTC: boolean = false,
): Date | T {
  if (typeof v == 'string') {
    const lower = v.toLowerCase();
    if (lower === 'now' || lower === 'today') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return asUTC
        ? getUTCDate(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            today.getHours(),
            today.getMinutes(),
            today.getSeconds(),
            today.getMilliseconds(),
          )
        : today;
    }
    if (lower === 'tomorrow') {
      const now = new Date();
      const tomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );
      return asUTC
        ? getUTCDate(
            tomorrow.getFullYear(),
            tomorrow.getMonth(),
            tomorrow.getDate(),
            tomorrow.getHours(),
            tomorrow.getMinutes(),
            tomorrow.getSeconds(),
            tomorrow.getMilliseconds(),
          )
        : tomorrow;
    }
    if (lower === 'yesterday') {
      const now = new Date();
      const yesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
      );
      return asUTC
        ? getUTCDate(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate(),
            yesterday.getHours(),
            yesterday.getMinutes(),
            yesterday.getSeconds(),
            yesterday.getMilliseconds(),
          )
        : yesterday;
    }
  }
  const dateV = new Date(v);
  if (isNaN(dateV.valueOf())) {
    return fallback;
  }
  if (dateV.toISOString().substring(10) === 'T00:00:00.000Z') {
    if (asUTC) {
      return dateV;
    }
    return new Date(
      dateV.getUTCFullYear(),
      dateV.getUTCMonth(),
      dateV.getUTCDate(),
      0,
      0,
      0,
      0,
    );
  }
  if (asUTC) {
    return getUTCDate(dateV.getFullYear(), dateV.getMonth(), dateV.getDate());
  }
  return new Date(
    dateV.getFullYear(),
    dateV.getMonth(),
    dateV.getDate(),
    0,
    0,
    0,
    0,
  );
}
