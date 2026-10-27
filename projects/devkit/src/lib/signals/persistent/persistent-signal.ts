import {
  afterNextRender,
  computed,
  effect,
  inject,
  Injector,
  runInInjectionContext,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { isAnyString, isNull } from 'simple-bool';

export interface PersistentSignalNonNullable<T> extends Signal<T> {
  readonly method: PersistentStorageMethod;
  readonly key: string;
  readonly serialized: Signal<string | null>;
}

export interface PersistentSignal<T>
  extends PersistentSignalNonNullable<T | null> {}

/**
 * A `PersistentSignal` is a specialized type of `WritableSignal` that automatically persists its value using a specified storage method (localStorage, sessionStorage, or cookies). It extends the standard `WritableSignal` interface by including additional properties to define the persistence mechanism and key used for storage. The `PersistentSignal` ensures that any changes to its value are saved to the chosen storage method, and it initializes its value from storage if available when created.
 */
export interface WritablePersistentSignalNonNullable<T>
  extends WritableSignal<T>,
    PersistentSignalNonNullable<T> {
  asReadonly(): PersistentSignalNonNullable<T>;
}

export interface WritablePersistentSignal<T>
  extends WritablePersistentSignalNonNullable<T | null> {
  clear(): void;
  asReadonly(): PersistentSignal<T>;
}

/**
 * Defines the available persistent storage methods for the `persistentSignal`. Each method corresponds to a different browser storage mechanism:
 * - `PersistentStorageMethod.LocalStorage`: Uses the browser's localStorage to persist the value across sessions.
 * - `PersistentStorageMethod.SessionStorage`: Uses the browser's sessionStorage to persist the value for the duration of the page session.
 * - `PersistentStorageMethod.Cookies`: Uses browser cookies to persist the value, allowing for additional options like expiration and path.
 */
export const PersistentStorageMethod = {
  Cookies: 'cookies',
  LocalStorage: 'local-storage',
  SessionStorage: 'session-storage',
} as const;
/**
 * Defines the available persistent storage methods for the `persistentSignal`. Each method corresponds to a different browser storage mechanism:
 * - `PersistentStorageMethod.LocalStorage`: Uses the browser's localStorage to persist the value across sessions.
 * - `PersistentStorageMethod.SessionStorage`: Uses the browser's sessionStorage to persist the value for the duration of the page session.
 * - `PersistentStorageMethod.Cookies`: Uses browser cookies to persist the value, allowing for additional options like expiration and path.
 */
export type PersistentStorageMethod =
  (typeof PersistentStorageMethod)[keyof typeof PersistentStorageMethod];

interface _PersistentSignalOptionsBase<T> {
  /**
   * The persistent storage method to use for storing the signal value. Options include:
   * - `PersistentStorageMethod.LocalStorage`: Uses the browser's localStorage to persist the value across sessions.
   * - `PersistentStorageMethod.SessionStorage`: Uses the browser's sessionStorage to persist the value for the duration of the page session.
   * - `PersistentStorageMethod.Cookies`: Uses browser cookies to persist the value, allowing for additional options like expiration and path.
   */
  method: PersistentStorageMethod;
  /**
   * Cookie-specific option: Defines the expiration date of the cookie. Can be a `Date` object or a string in UTC format. If not specified, the cookie will be a session cookie and will expire when the browser is closed.
   */
  expires?: Date | string;
  /**
   * Cookie-specific option: Defines the maximum age of the cookie in seconds. If both `expires` and `maxAge` are specified, `maxAge` takes precedence. If not specified, the cookie will be a session cookie and will expire when the browser is closed.
   */
  maxAge?: number;
  /**
   * Cookie-specific option: Defines the path for which the cookie is valid. Defaults to `'/'`, making the cookie accessible across the entire site. If set to a specific path, the cookie will only be sent to the server for requests matching that path.
   */
  path?: string;

  /**
   * Optional serialization function to convert the signal value into a string for storage. This is required if the signal value is not a string or if you want to customize the serialization format. The function should return a string representation of the value, or `null` if the value is `null`.
   * @param value The value to serialize, which can be of type `T` or `null`.
   * @returns A string representation of the value for storage, or `null` if the value is `null`.
   */
  serialize?: (value: T | null) => string | null;
  /**
   * Optional deserialization function to convert the stored string value back into the original type `T`. This is required if a custom `serialize` function is provided, or if the initial value is not a string and serialization options are not defined. The function should return the deserialized value of type `T`, or `null` if the input value is `null`.
   * @param value The string value retrieved from storage that needs to be deserialized back into the original type `T`. This function is required if a custom `serialize` function is provided, or if the initial value is not a string and serialization options are not defined. The function should return the deserialized value of type `T`, or `null` if the input value is `null`.
   * @returns The deserialized value of type `T`, or `null` if the input value is `null`.
   */
  deserialize?: (value: string) => T | null;

  /**
   * If true, creates a non-nullable persistent signal interface.
   */
  nonNullable?: boolean;

  /**
   * Optional Angular `Injector` to run the effect in the correct injection context. If not provided, the current injection context will be used.
   */
  injector?: Injector;
}
interface _PersistentSignalOptionsDeprecated<T>
  extends _PersistentSignalOptionsBase<T> {
  /**
   * @deprecated Use `key` instead. The name/key used to store the signal value in the chosen storage method.
   */
  name: string;
}
interface _PersistentSignalOptions<T> extends _PersistentSignalOptionsBase<T> {
  /**
   * The name/key used to store the signal value in the chosen storage method.
   */
  key: string;
}

/**
 * Options for persisting the signal value.
 */
export type PersistentSignalOptions<T> =
  | _PersistentSignalOptionsDeprecated<T>
  | _PersistentSignalOptions<T>;

function isSerializableSignal<T>(
  options: PersistentSignalOptions<T>,
): options is PersistentSignalOptions<T> &
  Required<Pick<_PersistentSignalOptionsBase<T>, 'serialize' | 'deserialize'>> {
  return !!options.serialize && !!options.deserialize;
}

/**
 * Creates a `WritableSignal` that persists its value using the specified storage method,
 * with custom serialization and deserialization.
 *
 * @param initialValue - The initial value of the signal if no stored value is found.
 * @param options - An object containing the storage method and custom serialization/deserialization functions.
 * @param options.name - The key used to store the signal value.
 * @param options.method - The persistent storage method (localStorage, sessionStorage, or cookies).
 * @param options.serialize - A function to serialize the value into a string for storage.
 * @param options.deserialize - A function to deserialize the stored string value back into the original type.
 * @returns A `WritableSignal<T>` that persists its value using the specified storage method.
 */
export function persistentSignal<T>(
  initialValue: T,
  options: PersistentSignalOptions<T> & { nonNullable: true },
): WritablePersistentSignalNonNullable<T>;
export function persistentSignal<T>(
  initialValue: T | null,
  options: PersistentSignalOptions<T>,
): WritablePersistentSignal<T>;
export function persistentSignal<T>(
  initialValue: T | null,
  options: PersistentSignalOptions<T>,
): WritablePersistentSignal<T> | WritablePersistentSignalNonNullable<T> {
  if (!!options.serialize !== !!options.deserialize) {
    throw new Error(
      'DKT-FT3000: Both serialize and deserialize must either be both defined or both undefined.',
    );
  }

  const isNonNullable = options.nonNullable === true;
  if (isNonNullable && isNull(initialValue)) {
    throw new Error(
      'DKT-FT3002: Non-nullable persistent signals require a non-null initial value.',
    );
  }

  if (
    !isSerializableSignal(options) &&
    !isAnyString(initialValue) &&
    !isNull(initialValue)
  ) {
    throw new Error(
      'DKT-FT3001: Non-string initial values are only allowed for serializable signals. Define serialization options.',
    );
  }

  const internalSignal = signal<T | null>(initialValue);

  const _asReadonly = internalSignal.asReadonly;

  if (isNonNullable) {
    const nonNullableSignal =
      internalSignal as WritablePersistentSignalNonNullable<T>;
    Object.assign(nonNullableSignal, {
      method: options.method,
      key: getKey(options),
      serialized: computed(() => serializeValue(nonNullableSignal(), options)),
    });

    _assignPersistentSignalListeners(nonNullableSignal, options);

    nonNullableSignal.asReadonly = () => {
      const readonlySignal = _asReadonly() as PersistentSignalNonNullable<T>;

      (readonlySignal as any).method = nonNullableSignal.method;
      (readonlySignal as any).key = nonNullableSignal.key;
      (readonlySignal as any).serialized = nonNullableSignal.serialized;

      return readonlySignal;
    };

    return nonNullableSignal;
  }

  const nullableSignal = internalSignal as WritablePersistentSignal<T>;
  Object.assign(nullableSignal, {
    method: options.method,
    key: getKey(options),
    serialized: computed(() => serializeValue(nullableSignal(), options)),
    clear: () => nullableSignal.set(null),
  });

  _assignPersistentSignalListeners(nullableSignal, options);

  nullableSignal.asReadonly = () => {
    const readonlySignal = _asReadonly() as PersistentSignal<T>;

    (readonlySignal as any).method = nullableSignal.method;
    (readonlySignal as any).key = nullableSignal.key;
    (readonlySignal as any).serialized = nullableSignal.serialized;

    return readonlySignal;
  };

  return nullableSignal;
}

function _assignPersistentSignalListeners<
  T,
  S extends
    | WritablePersistentSignal<T>
    | WritablePersistentSignalNonNullable<T>,
>(signal: S, options: PersistentSignalOptions<T>): void {
  afterNextRender(
    () => {
      const storedValue = loadFromStorage<T>(options);

      if (storedValue !== null) {
        signal.set(storedValue);
      } else {
        updateStorage(options, signal());
      }

      const injector = inject(Injector);

      runInInjectionContext(injector, () => {
        effect(() => {
          const value = signal();
          updateStorage(options, value);
        });
      });
    },
    { injector: options.injector },
  );
}

function loadFromStorage<T>(options: PersistentSignalOptions<T>): T | null {
  let storedValue: string | null = null;

  if (options.method === PersistentStorageMethod.LocalStorage) {
    storedValue = localStorage.getItem(getKey(options));
  } else if (options.method === PersistentStorageMethod.SessionStorage) {
    storedValue = sessionStorage.getItem(getKey(options));
  } else if (options.method === PersistentStorageMethod.Cookies) {
    const match = document.cookie.match(
      '(^|;)\\s*' + getKey(options) + '\\s*=\\s*([^;]+)',
    );
    storedValue = match ? decodeURIComponent(match[2]) : null;
  }
  return deserializeValue(storedValue, options);
}

function updateStorage<T>(
  options: PersistentSignalOptions<T>,
  value: T | null,
): void {
  const serializedValue = serializeValue(value, options);

  if (options.method === PersistentStorageMethod.LocalStorage) {
    if (serializedValue === null) localStorage.removeItem(getKey(options));
    else localStorage.setItem(getKey(options), serializedValue);
  } else if (options.method === PersistentStorageMethod.SessionStorage) {
    if (serializedValue === null) sessionStorage.removeItem(getKey(options));
    else sessionStorage.setItem(getKey(options), serializedValue);
  } else if (options.method === PersistentStorageMethod.Cookies) {
    let cookieString = `${getKey(options)}=${serializedValue !== null ? encodeURIComponent(serializedValue) : ''}`;

    if (serializedValue !== null) {
      cookieString += `; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
    } else if (options.expires) {
      const expires =
        options.expires instanceof Date
          ? options.expires.toUTCString()
          : options.expires;
      cookieString += `; expires=${expires}`;
    }

    if (options.maxAge) {
      cookieString += `; max-age=${options.maxAge}`;
    }

    cookieString += `; path=${options.path ?? '/'}`;

    document.cookie = cookieString;
  }
}

function getKey<T>(options: PersistentSignalOptions<T>): string {
  return 'key' in options ? options.key : options.name;
}

function serializeValue<T>(
  value: T | null,
  options: PersistentSignalOptions<T>,
): string | null {
  if (isSerializableSignal(options)) {
    return options.serialize(value);
  }
  return value === null ? null : (value as unknown as string);
}

function deserializeValue<T>(
  value: string | null,
  options: PersistentSignalOptions<T>,
): T | null {
  if (value !== null && isSerializableSignal(options)) {
    return options.deserialize(value);
  }
  return value as unknown as T | null;
}
