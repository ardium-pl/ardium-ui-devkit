import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  runInInjectionContext,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { isAnyString, isNull } from 'simple-bool';

export interface QueryParamSignalNonNullable<T> extends Signal<T> {
  /**
   * The name of the query parameter used to store the signal value.
   */
  readonly paramName: string;

  /**
   * Computed signal that returns the serialized value of the signal.
   */
  readonly serialized: Signal<string | null>;
}

export interface QueryParamSignal<T>
  extends QueryParamSignalNonNullable<T | null> {}

export interface WritableQueryParamSignalNonNullable<T>
  extends WritableSignal<T>,
    QueryParamSignalNonNullable<T> {
  asReadonly(): QueryParamSignalNonNullable<T>;
}

export interface WritableQueryParamSignal<T>
  extends WritableQueryParamSignalNonNullable<T | null>,
    QueryParamSignal<T> {
  clear(): void;
  asReadonly(): QueryParamSignal<T>;
}

export interface QueryParamSignalOptions<T> {
  paramName: string;
  serialize?: (value: T | null) => string | null;
  deserialize?: (value: string) => T | null;
  nonNullable?: boolean;
}

function isSerializableSignal<T>(
  options: QueryParamSignalOptions<T>,
): options is QueryParamSignalOptions<T> &
  Required<Pick<QueryParamSignalOptions<T>, 'serialize' | 'deserialize'>> {
  return !!options.serialize && !!options.deserialize;
}

/**
 * Creates a `WritableSignal` that persists its value in a URL query parameter with both serialization and deserialization.
 *
 * @param initialValue - The initial value of the signal if no value is found in the query param.
 * @param options - An object containing the query parameter name, and custom serialization/deserialization functions.
 * @param options.paramName - The name of the query parameter used to store the signal value.
 * @param options.serialize - A function to serialize the value into a string for the query parameter.
 * @param options.deserialize - A function to deserialize the value from a string back to the original type.
 * @param options.nonNullable - If true, returns a non-nullable signal interface.
 * @returns A `WritableSignal<T | null>` that persists its value using the specified query parameter.
 */
export function queryParamSignal<T>(
  initialValue: T,
  options: QueryParamSignalOptions<T> & { nonNullable: true },
): WritableQueryParamSignalNonNullable<T>;
export function queryParamSignal<T>(
  initialValue: T | null,
  optionsOrParam: string | QueryParamSignalOptions<T>,
): WritableQueryParamSignal<T>;
export function queryParamSignal<T>(
  initialValue: T | null,
  optionsOrParam: string | QueryParamSignalOptions<T>,
): WritableQueryParamSignal<T> | WritableQueryParamSignalNonNullable<T> {
  let options: QueryParamSignalOptions<T>;

  if (typeof optionsOrParam === 'string') {
    options = { paramName: optionsOrParam };
  } else {
    options = optionsOrParam;
  }

  if (!!options.serialize !== !!options.deserialize) {
    throw new Error(
      'DKT-FT3010: Both serialize and deserialize must either be both defined or both undefined.',
    );
  }

  const isNonNullable = options.nonNullable === true;
  if (isNonNullable && isNull(initialValue)) {
    throw new Error(
      'DKT-FT3012: Non-nullable query param signals require a non-null initial value.',
    );
  }

  if (
    !isSerializableSignal(options) &&
    !isAnyString(initialValue) &&
    !isNull(initialValue)
  ) {
    throw new Error(
      'DKT-FT3011: Non-string initial values are only allowed for serializable signals. Define serialization options.',
    );
  }

  const internalSignal = signal<T | null>(initialValue);

  const _asReadonly = internalSignal.asReadonly;

  if (isNonNullable) {
    const nonNullableSignal =
      internalSignal as WritableQueryParamSignalNonNullable<T>;
    Object.assign(nonNullableSignal, {
      paramName: options.paramName,
      serialized: computed(() => serializeValue(nonNullableSignal(), options)),
    });

    _assignQueryParamListeners(nonNullableSignal, initialValue, options);

    nonNullableSignal.asReadonly = () => {
      const readonlySignal = _asReadonly() as QueryParamSignalNonNullable<T>;

      (readonlySignal as any).serialized = nonNullableSignal.serialized;

      return readonlySignal;
    };

    return nonNullableSignal;
  }

  const nullableSignal = internalSignal as WritableQueryParamSignal<T>;
  Object.assign(nullableSignal, {
    paramName: options.paramName,
    serialized: computed(() => serializeValue(nullableSignal(), options)),
    clear: () => nullableSignal.set(null),
  });

  _assignQueryParamListeners(nullableSignal, initialValue, options);

  nullableSignal.asReadonly = () => {
    const readonlySignal = _asReadonly() as QueryParamSignal<T>;

    (readonlySignal as any).serialized = nullableSignal.serialized;

    return readonlySignal;
  };

  return nullableSignal;
}

function _assignQueryParamListeners<
  T,
  S extends
    | WritableQueryParamSignal<T>
    | WritableQueryParamSignalNonNullable<T>,
>(
  signal: S,
  initialValue: T | null,
  options: QueryParamSignalOptions<T>,
): void {
  const router = inject(Router);
  const storedValue = loadFromQueryParam(router, options);
  const destroyRef = inject(DestroyRef);
  const injector = inject(Injector);
  let isApplyingRouterValue = false;

  if (storedValue !== null) {
    signal.set(storedValue);
  } else {
    updateQueryParam(router, options, signal());
  }

  setTimeout(() => {
    updateQueryParam(router, options, signal());
  }, 0);

  router.events
    .pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe(() => {
      const nextValue = loadFromQueryParam(router, options);
      const writableSignal = signal as WritableSignal<T | null>;
      if (options.nonNullable === true && nextValue === null) {
        writableSignal.set(initialValue);
        return;
      }

      const currentSerialized = serializeValue(writableSignal(), options);
      const nextSerialized = serializeValue(nextValue, options);
      if (currentSerialized === nextSerialized) {
        return;
      }

      isApplyingRouterValue = true;
      writableSignal.set(nextValue);
      isApplyingRouterValue = false;
    });

  runInInjectionContext(injector, () => {
    effect(() => {
      if (isApplyingRouterValue) {
        return;
      }
      updateQueryParam(router, options, signal());
    });
  });
}

function loadFromQueryParam<T>(
  router: Router,
  options: QueryParamSignalOptions<T>,
): T | null {
  const urlTree = router.parseUrl(router.url);
  const queryParamValue = urlTree.queryParams[options.paramName];
  const storedValue =
    queryParamValue === undefined || queryParamValue === null
      ? null
      : String(queryParamValue);

  return deserializeValue(storedValue, options);
}

function updateQueryParam<T>(
  router: Router,
  options: QueryParamSignalOptions<T>,
  value: T | null,
): void {
  const serializedValue = serializeValue(value, options);
  const urlTree = router.parseUrl(router.url);
  const currentParam =
    urlTree.queryParams[options.paramName] == null
      ? null
      : String(urlTree.queryParams[options.paramName]);

  if (currentParam === serializedValue) {
    return;
  }

  const queryParams = {
    ...urlTree.queryParams,
    [options.paramName]: serializedValue,
  };

  router.navigate([], {
    queryParams,
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}

function serializeValue<T>(
  value: T | null,
  options: QueryParamSignalOptions<T>,
): string | null {
  if (isSerializableSignal(options)) {
    return options.serialize(value);
  }
  return value === null ? null : (value as unknown as string);
}

function deserializeValue<T>(
  value: string | null,
  options: QueryParamSignalOptions<T>,
): T | null {
  if (value !== null && isSerializableSignal(options)) {
    return options.deserialize(value);
  }
  return value as unknown as T | null;
}
