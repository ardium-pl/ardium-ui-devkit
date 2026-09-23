import { computed, signal, Signal, WritableSignal } from '@angular/core';

/**
 * A read-only set signal with non-mutating methods.
 */
export interface SetSignal<T> extends Signal<Set<T>> {
  /**
   * Computed signal that returns `true` if the set is empty.
   */
  readonly isEmpty: Signal<boolean>;
  /**
   * Computed signal for set size.
   */
  readonly size: Signal<number>;

  /**
   * Checks if a value exists in the set.
   */
  has(value: T): boolean;

  /**
   * Computed signal that returns a new array from the set.
   */
  readonly asArray: Signal<T[]>;
}

/**
 * A writable set signal with mutating and non-mutating methods.
 */
export interface WritableSetSignal<T>
  extends WritableSignal<Set<T>>,
    SetSignal<T> {
  /**
   * Returns a read-only version of the set signal.
   */
  asReadonly(): SetSignal<T>;

  /**
   * Adds a value to the set.
   */
  add(value: T): void;

  /**
   * Deletes a value from the set.
   * @returns true if a value was removed.
   */
  delete(value: T): boolean;

  /**
   * Toggles a value in the set. If the value exists, it will be removed; if it does not exist, it will be added.
   * @returns true if the value was added, false if it was removed.
   */
  toggle(value: T): boolean;

  /**
   * Clears the set.
   */
  clear(): void;

  /**
   * Replaces the set with a new set.
   */
  set(value: Set<T>): void;

  /**
   * Updates the set using an update function.
   */
  update(updateFn: (current: Set<T>) => Set<T>): void;
}

/**
 * Creates a writable, reactive Set signal with convenient, immutable Set manipulation methods.
 *
 * This function returns a signal that wraps a JavaScript `Set` and exposes both non-mutating and mutating helpers,
 * ensuring that all operations are fully reactive and immutably safe. All mutator methods (`add`, `delete`, `clear`, etc.)
 * return a new Set value for robust signal reactivity.
 *
 * Also provides computed signals for queries such as `isEmpty`, `size`, and `asArray`, and offers a type-safe, read-only
 * view via `.asReadonly()`.
 *
 * @template T The type of items stored in the set.
 * @param {Iterable<T>} [initialValue=[]] Optional initial values for the set (can be another Set or any iterable).
 * @returns {WritableSetSignal<T>} A writable Set signal instance with both native and Set-specific helpers.
 *
 * @example
 * const ids = setSignal<number>([1, 2, 3]);
 * ids.add(4);              // [1, 2, 3, 4]
 * ids.delete(2);           // removes 2
 * ids.has(3);              // true
 * ids.asArray();           // [1, 3, 4]
 * ids.clear();             // empty set
 * ids.isEmpty();           // true
 */
export function setSignal<T>(
  initialValue: Iterable<T> = [],
): WritableSetSignal<T> {
  const internalSignal = signal<Set<T>>(
    new Set(initialValue),
  ) as WritableSetSignal<T>;

  const _set = internalSignal.set;
  const _update = internalSignal.update;
  const _asReadonly = internalSignal.asReadonly;

  // Native signal methods
  internalSignal.set = (value: Set<T>) => _set(new Set(value));
  internalSignal.update = (updateFn: (value: Set<T>) => Set<T>) => {
    _update((current) => new Set(updateFn(current)));
  };

  // Computed helpers
  (internalSignal.isEmpty as any) = computed(() => internalSignal().size === 0);
  (internalSignal.size as any) = computed(() => internalSignal().size);

  // Set methods
  internalSignal.add = (value: T) => {
    internalSignal.update((set) => {
      if (set.has(value)) return set;
      const copy = new Set(set);
      copy.add(value);
      return copy;
    });
  };

  internalSignal.delete = (value: T): boolean => {
    let deleted = false;
    internalSignal.update((set) => {
      if (!set.has(value)) return set;
      const copy = new Set(set);
      deleted = copy.delete(value);
      return copy;
    });
    return deleted;
  };

  internalSignal.toggle = (value: T): boolean => {
    let added = false;
    internalSignal.update((set) => {
      const copy = new Set(set);
      if (copy.has(value)) {
        copy.delete(value);
      } else {
        copy.add(value);
        added = true;
      }
      return copy;
    });
    return added;
  };

  internalSignal.clear = () => {
    internalSignal.set(new Set<T>());
  };

  internalSignal.has = (value: T): boolean => {
    return internalSignal().has(value);
  };

  (internalSignal.asArray as any) = computed(() =>
    Array.from(internalSignal()),
  );

  internalSignal.asReadonly = () => {
    const readonlySignal = _asReadonly() as SetSignal<T>;
    (readonlySignal.isEmpty as any) = internalSignal.isEmpty;
    (readonlySignal.size as any) = internalSignal.size;
    (readonlySignal.asArray as any) = internalSignal.asArray;
    return readonlySignal;
  };

  return internalSignal;
}
