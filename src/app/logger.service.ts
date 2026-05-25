import { Injectable, isDevMode } from '@angular/core';

const PREFIX = '[ICS Today]';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  debug(...args: unknown[]): void {
    if (isDevMode()) console.debug(PREFIX, ...args);
  }

  info(...args: unknown[]): void {
    console.info(PREFIX, ...args);
  }

  warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args);
  }

  error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
  }
}
