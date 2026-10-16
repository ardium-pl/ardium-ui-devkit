import { computed, inject, Injector, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  AsyncValidatorFn,
  ControlValueAccessor,
  FormControlStatus,
  isFormArray,
  isFormControl,
  isFormGroup,
  isFormRecord,
  NgControl,
  PristineChangeEvent,
  StatusChangeEvent,
  TouchedChangeEvent,
  ValidationErrors,
  ValidatorFn,
  ValueChangeEvent,
} from '@angular/forms';
import {
  BehaviorSubject,
  isObservable,
  map,
  Observable,
  Subscription,
} from 'rxjs';
import { isFunction } from 'simple-bool';

export interface FormControlTrackerOptions {
  injector?: Injector;
}
export interface BoundControlTrackerOptions extends FormControlTrackerOptions {
  attachValueAccessor?: boolean;
}

export interface TrackedFormControl<T> {
  readonly instance: AbstractControl<T>;
  readonly value$: Observable<T>;
  readonly value: Signal<T>;
  readonly errors$: Observable<ValidationErrors | null>;
  readonly errors: Signal<ValidationErrors | null>;
  readonly touched$: Observable<boolean>;
  readonly touched: Signal<boolean>;
  readonly untouched$: Observable<boolean>;
  readonly untouched: Signal<boolean>;
  readonly pristine$: Observable<boolean>;
  readonly pristine: Signal<boolean>;
  readonly dirty$: Observable<boolean>;
  readonly dirty: Signal<boolean>;
  readonly status$: Observable<FormControlStatus>;
  readonly status: Signal<FormControlStatus>;
  readonly valid$: Observable<boolean>;
  readonly valid: Signal<boolean>;
  readonly invalid$: Observable<boolean>;
  readonly invalid: Signal<boolean>;
  readonly pending$: Observable<boolean>;
  readonly pending: Signal<boolean>;
  readonly disabled$: Observable<boolean>;
  readonly disabled: Signal<boolean>;
  readonly enabled$: Observable<boolean>;
  readonly enabled: Signal<boolean>;
  readonly touchedHasErrors: Signal<boolean>;
  readonly validators$: Observable<ValidatorFn[] | null>;
  readonly validators: Signal<ValidatorFn[] | null>;
  readonly asyncValidators$: Observable<AsyncValidatorFn[] | null>;
  readonly asyncValidators: Signal<AsyncValidatorFn[] | null>;

  init(): void;
  destroy(): void;
}

class FormControlTracker<T> {
  constructor(
    private readonly thisObjOrAbstractControl: any | AbstractControl,
    private readonly options: BoundControlTrackerOptions = {},
  ) {
    if (this._isAbstractControl(this.thisObjOrAbstractControl)) {
      this.init();
    }
  }

  private readonly _injector = this.options.injector ?? inject(Injector);

  /** The AbstractControl instance attached to the component instance. */
  public readonly instance!: AbstractControl<T>;

  private readonly _value$ = new BehaviorSubject<T>(undefined as T);
  public readonly value$ = this._value$.asObservable();
  public readonly value = toSignal(this._value$, {
    injector: this._injector,
    initialValue: undefined as T,
  });

  private readonly _errors$ = new BehaviorSubject<ValidationErrors | null>(
    null,
  );
  public readonly errors$ = this._errors$.asObservable();
  public readonly errors = toSignal(this._errors$, {
    injector: this._injector,
    initialValue: null,
  });

  private readonly _touched$ = new BehaviorSubject<boolean>(false);
  public readonly touched$ = this._touched$.asObservable();
  public readonly touched = toSignal(this._touched$, {
    injector: this._injector,
    initialValue: false,
  });
  public readonly untouched$ = this.touched$.pipe(map((v) => !v));
  public readonly untouched = toSignal(this.untouched$, {
    injector: this._injector,
    initialValue: true,
  });

  private readonly _pristine$ = new BehaviorSubject<boolean>(true);
  public readonly pristine$ = this._pristine$.asObservable();
  public readonly pristine = toSignal(this._pristine$, {
    injector: this._injector,
    initialValue: true,
  });
  public readonly dirty$ = this.pristine$.pipe(map((v) => !v));
  public readonly dirty = toSignal(this.dirty$, {
    injector: this._injector,
    initialValue: false,
  });

  private readonly _status$ = new BehaviorSubject<FormControlStatus>('VALID');
  public readonly status$ = this._status$.asObservable();
  public readonly status = toSignal(this._status$, {
    injector: this._injector,
    initialValue: 'VALID',
  });
  public readonly valid$ = this.status$.pipe(map((v) => v === 'VALID'));
  public readonly valid = toSignal(this.valid$, {
    injector: this._injector,
    initialValue: true,
  });
  public readonly invalid$ = this.status$.pipe(map((v) => v === 'INVALID'));
  public readonly invalid = toSignal(this.invalid$, {
    injector: this._injector,
    initialValue: false,
  });
  public readonly pending$ = this.status$.pipe(map((v) => v === 'PENDING'));
  public readonly pending = toSignal(this.pending$, {
    injector: this._injector,
    initialValue: false,
  });
  public readonly disabled$ = this.status$.pipe(map((v) => v === 'DISABLED'));
  public readonly disabled = toSignal(this.disabled$, {
    injector: this._injector,
    initialValue: false,
  });
  public readonly enabled$ = this.status$.pipe(map((v) => v !== 'DISABLED'));
  public readonly enabled = toSignal(this.enabled$, {
    injector: this._injector,
    initialValue: true,
  });

  public readonly touchedHasErrors = computed(
    () => !!this.errors() && this.touched(),
  );

  private readonly _validators$ = new BehaviorSubject<ValidatorFn[] | null>(
    null,
  );
  public readonly validators$ = this._validators$.asObservable();
  public readonly validators = toSignal(this._validators$, {
    injector: this._injector,
    initialValue: null,
  });

  private readonly _asyncValidators$ = new BehaviorSubject<
    AsyncValidatorFn[] | null
  >(null);
  public readonly asyncValidators$ = this._asyncValidators$.asObservable();
  public readonly asyncValidators = toSignal(this._asyncValidators$, {
    injector: this._injector,
    initialValue: null,
  });

  private _eventsSub?: Subscription;

  private _isAbstractControl(v: unknown): v is AbstractControl {
    return (
      isFormControl(v) ||
      isFormArray(v) ||
      isFormGroup(v) ||
      isFormRecord(v) ||
      (!!v && typeof v === 'object' && 'events' in v && isObservable(v.events))
    );
  }

  init() {
    if (this._isAbstractControl(this.thisObjOrAbstractControl)) {
      (this as any).instance = this.thisObjOrAbstractControl;
    } else {
      const ngControl = this._injector.get(NgControl, null);

      if (ngControl) {
        // if the valueAccessor was not yet set by Angular, we have to do it manually here
        if (this.options.attachValueAccessor ?? true) {
          if (
            !ngControl.valueAccessor ||
            (this.thisObjOrAbstractControl &&
              this.thisObjOrAbstractControl instanceof
                (ngControl.valueAccessor as any).constructor)
          ) {
            ngControl.valueAccessor = this
              .thisObjOrAbstractControl as unknown as ControlValueAccessor;
          }
        }
        // grab the AbstractControl instance
        const instance = ngControl.control as AbstractControl<T> | unknown;
        // ensure that control is not InteropNgControl from Angular 22
        // (even though the library is using Angular 18)
        // but it causes issues when paired with signal forms
        // InteropNgControl is always recurrently linked to itself through the control property
        if (
          !instance ||
          typeof instance !== 'object' ||
          ('control' in instance && instance.control === instance) ||
          !('events' in instance) ||
          !isObservable(instance.events)
        ) {
          return;
        }
        (this as any).instance = instance;
      }
    }

    if (this.instance) {
      const instance = this.instance;
      // listen to all data available in the events emitter
      this._eventsSub = instance.events.subscribe((event) => {
        if (event instanceof ValueChangeEvent) {
          this._value$.next(event.value);
          return;
        }
        if (event instanceof TouchedChangeEvent) {
          this._touched$.next(event.touched);
          return;
        }
        if (event instanceof PristineChangeEvent) {
          this._pristine$.next(event.pristine);
          return;
        }
        if (event instanceof StatusChangeEvent) {
          this._status$.next(event.status);
          this._errors$.next(event.source.errors);
          return;
        }
      });

      this._value$.next(instance.value);
      this._touched$.next(instance.touched);
      this._pristine$.next(instance.pristine);
      this._status$.next(instance.status);
      this._errors$.next(instance.errors);

      // do not read the next lines of code if you are easily frightened
      // I'm not proud of this part, but it had to be done. God please forgive me
      // I didn't find any other feasible way to detect when the control changes its validators
      // so it had to be hacked like this

      // override the "setValidators" function to capture the validators
      const oldSetValidators = instance.setValidators.bind(instance);
      instance.setValidators = (
        ...args: Parameters<typeof instance.setValidators>
      ) => {
        oldSetValidators(...args);

        const validators = (instance as any)._rawValidators as
          | ValidatorFn
          | ValidatorFn[]
          | null;
        this._validators$.next(
          isFunction(validators) ? [validators] : validators,
        );
      };
      // override the "validator" setter to capture the validators
      wrapSetter<AbstractControl<T>>(instance, 'validator', () => {
        const raw = (instance as any)._rawValidators as
          | ValidatorFn
          | ValidatorFn[]
          | null;
        this._validators$.next(isFunction(raw) ? [raw] : raw);
      });

      // override the "setAsyncValidators" function to capture the async validators
      const oldSetAsyncValidators = instance.setAsyncValidators.bind(instance);
      instance.setAsyncValidators = (
        ...args: Parameters<typeof instance.setAsyncValidators>
      ) => {
        oldSetAsyncValidators(...args);

        const validators = (instance as any)._rawAsyncValidators as
          | AsyncValidatorFn
          | AsyncValidatorFn[]
          | null;
        this._asyncValidators$.next(
          isFunction(validators) ? [validators] : validators,
        );
      };
      // override the "asyncValidator" setter to capture the async validators
      wrapSetter<AbstractControl<T>>(instance, 'asyncValidator', () => {
        const raw = (instance as any)._rawAsyncValidators as
          | AsyncValidatorFn
          | AsyncValidatorFn[]
          | null;
        this._asyncValidators$.next(isFunction(raw) ? [raw] : raw);
      });

      // assign the validators at init time
      const validators = (instance as any)._rawValidators as
        | ValidatorFn
        | ValidatorFn[]
        | null;
      this._validators$.next(
        isFunction(validators) ? [validators] : validators,
      );
      const asyncValidators = (instance as any)._rawAsyncValidators as
        | AsyncValidatorFn
        | AsyncValidatorFn[]
        | null;
      this._asyncValidators$.next(
        isFunction(asyncValidators) ? [asyncValidators] : asyncValidators,
      );
    }
  }

  destroy() {
    this._eventsSub?.unsubscribe();
  }
}

/**
 * Gives reactive access to the properties of the given form control.
 *
 * Call `destroy()` to dispose of form control tracker.
 *
 * @param formControl the form control to be tracked.
 * @param options optional configuration for the form control tracker.
 * @returns an object containing all standard form control getters as signals.
 * @example
 * ```
 * readonly ageControl = new FormControl('John');
 *
 * readonly ageControlTracker = trackFormControl(this.ageControl);
 * ```
 */
export function trackFormControl<T = any>(
  formControl: AbstractControl<T>,
  options?: FormControlTrackerOptions,
): TrackedFormControl<T> {
  return new FormControlTracker<T>(formControl, {
    ...options,
    attachValueAccessor: false,
  });
}

/**
 * Gives reactive access to the properties of the Form Control assigned to the component instance.
 *
 * Call the `init()` method inside `ngOnInit()` to start listening to the Form Control, call `destroy()` to dispose of the listener.
 *
 * @param thisObj the component instance.
 * @param options optional configuration for the form control tracker.
 * @returns an object containing all standard form control getters as signals.
 * @example
 * ```
 * export class MyComponent implements ControlValueAccessor, OnInit, OnDestroy {
 *   readonly control = trackFormControl(this);
 *
 *   ngOnInit(): void {
 *     this.control.init();
 *   }
 *   ngOnDestroy(): void {
 *     this.control.destroy();
 *   }
 *   // control value accessor implementation ...
 * }
 * ```
 */
export function trackBoundControl<T = any>(
  thisObj: any,
  options?: BoundControlTrackerOptions,
): TrackedFormControl<T> {
  return new FormControlTracker<T>(thisObj, options);
}

// --- helper: wraps an accessor setter on a single instance ---
function wrapSetter<TObj extends object>(
  obj: TObj,
  propName: keyof TObj,
  after: () => void,
) {
  // find the accessor descriptor up the prototype chain
  let proto: any = obj;
  let desc: PropertyDescriptor | undefined;

  while (proto && !(desc = Object.getOwnPropertyDescriptor(proto, propName))) {
    proto = Object.getPrototypeOf(proto);
  }

  if (!desc || typeof desc.set !== 'function') {
    throw new Error(`No setter found for ${String(propName)}`);
  }

  const originalSet = desc.set!;
  const originalGet = desc.get; // may exist

  Object.defineProperty(obj, propName, {
    configurable: true,
    enumerable: desc.enumerable ?? true,

    get: originalGet
      ? function (this: TObj) {
          return originalGet.call(this);
        }
      : undefined,

    set: function (this: TObj, value: unknown) {
      originalSet.call(this, value);
      after();
    },
  });
}
