import {
  afterNextRender,
  computed,
  Injectable,
  OnDestroy,
  Renderer2,
  signal,
  WritableSignal,
} from '@angular/core';
import { ɵDomRendererFactory2 } from '@angular/platform-browser';
import { filter, map, Observable, Subject } from 'rxjs';
import {
  KeyboardKey,
  KeyboardKeyState,
  KeyboardShortcut,
} from './keyboard.types';
import {
  _ExpectedModifierKeySide,
  _KeyboardShortcutInternal,
} from './types-internal';
import { isModifierKeyInWrongState, trySettingModifierKey } from './utils';

@Injectable({
  providedIn: 'root',
})
export class KeyboardService implements OnDestroy {
  private renderer!: Renderer2;
  private removeListenFuncKeydown!: Function;
  private removeListenFuncKeyup!: Function;
  private removeListenFuncWindowblur!: Function;
  constructor(rendererFactory: ɵDomRendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    //listen to events
    afterNextRender(() => {
      this.removeListenFuncKeydown = this.renderer.listen(
        'document',
        'keydown',
        (e) => this._onKeydown(e),
      );
      this.removeListenFuncKeyup = this.renderer.listen(
        'document',
        'keyup',
        (e) => this._onKeyup(e),
      );
      this.removeListenFuncWindowblur = this.renderer.listen(
        'window',
        'blur',
        () => this._resetAllKeys(),
      );
    });
  }

  ngOnDestroy(): void {
    //destroy event listeners
    this.removeListenFuncKeydown();
    this.removeListenFuncKeyup();
    this.removeListenFuncWindowblur();
  }

  private _resetAllKeys(): void {
    this._isLeftCtrlHeld.set(false);
    this._isRightCtrlHeld.set(false);
    this._isLeftAltHeld.set(false);
    this._isRightAltHeld.set(false);
    this._isLeftShiftHeld.set(false);
    this._isRightShiftHeld.set(false);
    this._isLeftMetaHeld.set(false);
    this._isRightMetaHeld.set(false);
  }

  private readonly _isLeftCtrlHeld = signal<boolean>(false);
  private readonly _isRightCtrlHeld = signal<boolean>(false);
  public readonly isLeftCtrlHeld = this._isLeftCtrlHeld.asReadonly();
  public readonly isRightCtrlHeld = this._isRightCtrlHeld.asReadonly();
  public readonly isCtrlHeld = computed(
    () => this._isLeftCtrlHeld() || this._isRightCtrlHeld(),
  );

  private readonly _isLeftAltHeld = signal<boolean>(false);
  private readonly _isRightAltHeld = signal<boolean>(false);
  public readonly isAltHeld = this._isLeftAltHeld.asReadonly();
  public readonly isAltGraphHeld = this._isRightAltHeld.asReadonly();

  private readonly _isLeftShiftHeld = signal<boolean>(false);
  private readonly _isRightShiftHeld = signal<boolean>(false);
  public readonly isLeftShiftHeld = this._isLeftShiftHeld.asReadonly();
  public readonly isRightShiftHeld = this._isRightShiftHeld.asReadonly();
  public readonly isShiftHeld = computed(
    () => this._isLeftShiftHeld() || this._isRightShiftHeld(),
  );

  // "⊞ Win" on Windows, "⌘ Command" on Mac
  private readonly _isLeftMetaHeld = signal<boolean>(false);
  private readonly _isRightMetaHeld = signal<boolean>(false);
  public readonly isLeftMetaHeld = this._isLeftMetaHeld.asReadonly();
  public readonly isRightMetaHeld = this._isRightMetaHeld.asReadonly();
  public readonly isMetaHeld = computed(
    () => this._isLeftMetaHeld() || this._isRightMetaHeld(),
  );

  private readonly isAnyModifierKeyHeld = computed(
    () =>
      this.isCtrlHeld() ||
      this.isAltHeld() ||
      this.isAltGraphHeld() ||
      this.isShiftHeld() ||
      this.isMetaHeld(),
  );

  private readonly _capsLockState = signal<boolean | undefined>(undefined);
  public readonly capsLockState = this._capsLockState.asReadonly();

  private readonly _numLockState = signal<boolean | undefined>(undefined);
  public readonly numLockState = this._numLockState.asReadonly();

  private readonly _scrollLockState = signal<boolean | undefined>(undefined);
  public readonly scrollLockState = this._scrollLockState.asReadonly();

  //! key subjects
  private readonly _shortcutSubject$ = new Subject<_KeyboardShortcutInternal>();
  public readonly anyShortcut$ = this._shortcutSubject$.pipe(
    map((v) => v.publicData),
  );

  private readonly _keySubject$ = new Subject<KeyboardKey>();
  public readonly anyKeyPress$ = this._keySubject$.asObservable();

  private readonly _keyStateSubject$ = new Subject<KeyboardKeyState>();
  public readonly anyKeyState$ = this._keyStateSubject$.asObservable();

  private _demapKeyCode(code: string): string {
    code = code.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (code.match(/^(left|right|up|down)$/))
      return `Arrow${code.charAt(0).toUpperCase()}${code.substring(1)}`;
    if (code.match(/^[a-z]$/)) return `Key${code.toUpperCase()}`;
    if (code.match(/^\d$/)) return `Digit${code}`;
    if (code === 'ctrl') return 'control';
    if (code === 'ctrlleft') return 'controlleft';
    if (code === 'alt') return 'altleft';
    if (code.match(/^altgr(aph)?$/)) return 'altright';
    if (code.match(/^win(dows)?$/)) return 'meta';
    if (code === 'cmd') return 'meta';
    return code;
  }
  private _emitShortcut(event: KeyboardEvent): void {
    const keys = [];
    if (this._isLeftCtrlHeld()) keys.push('ControlLeft');
    if (this._isRightCtrlHeld()) keys.push('ControlRight');
    if (this._isLeftAltHeld()) keys.push('AltLeft');
    if (this._isRightAltHeld()) keys.push('AltRight');
    if (this._isLeftShiftHeld()) keys.push('ShiftLeft');
    if (this._isRightShiftHeld()) keys.push('ShiftRight');
    if (this._isLeftMetaHeld()) keys.push('MetaLeft');
    if (this._isRightMetaHeld()) keys.push('MetaRight');
    keys.push(event.code);

    this._shortcutSubject$.next({
      ctrl: {
        left: this._isLeftCtrlHeld(),
        right: this._isRightCtrlHeld(),
      },
      alt: {
        left: this._isLeftAltHeld(),
        right: this._isRightAltHeld(),
      },
      shift: {
        left: this._isLeftShiftHeld(),
        right: this._isRightShiftHeld(),
      },
      meta: {
        left: this._isLeftMetaHeld(),
        right: this._isRightMetaHeld(),
      },
      key: event.code.toLowerCase(),
      publicData: {
        keys,
        event,
      },
    });
  }
  private _emitKeydown(event: KeyboardEvent): void {
    const key = event.code;
    this._keySubject$.next({ key, event });
  }
  private _emitKeyStateDown(event: KeyboardEvent): void {
    const key = event.code;
    this._keyStateSubject$.next({ key, event, isHeld: true });
  }
  private _emitKeyStateUp(event: KeyboardEvent): void {
    const key = event.code;
    this._keyStateSubject$.next({ key, event, isHeld: false });
  }

  listenToShortcut(
    toMatch: string[],
    treatAltGraphAsAltPlusCtrl: boolean = true,
  ): Observable<KeyboardShortcut> {
    const expectedStates = {
      ctrl: _ExpectedModifierKeySide.None,
      alt: _ExpectedModifierKeySide.None,
      shift: _ExpectedModifierKeySide.None,
      meta: _ExpectedModifierKeySide.None,
    } as {
      [key in 'ctrl' | 'alt' | 'shift' | 'meta']: _ExpectedModifierKeySide;
    };
    let ctrlKey: string | null = null;
    let altKey: string | null = null;
    let isAltGraphExpected: boolean = false;
    let shiftKey: string | null = null;
    let metaKey: string | null = null;
    let expectedKey: string | null = null;
    let success = false;
    for (const rawKey of toMatch) {
      const key = this._demapKeyCode(rawKey).toLowerCase();
      success = false;

      [expectedStates.ctrl, ctrlKey, success] = trySettingModifierKey(
        'control',
        key,
        rawKey,
        ctrlKey,
        expectedStates.ctrl,
      );
      if (success) continue;
      [expectedStates.alt, altKey, success] = trySettingModifierKey(
        'alt',
        key,
        rawKey,
        altKey,
        expectedStates.alt,
      );
      if (key === 'altright') {
        isAltGraphExpected = true;
      }
      if (success) continue;
      [expectedStates.shift, shiftKey, success] = trySettingModifierKey(
        'shift',
        key,
        rawKey,
        shiftKey,
        expectedStates.shift,
      );
      if (success) continue;
      [expectedStates.meta, metaKey, success] = trySettingModifierKey(
        'meta',
        key,
        rawKey,
        metaKey,
        expectedStates.meta,
      );
      if (success) continue;

      if (expectedKey) {
        console.error(
          new Error(
            `DKT-NF0031: A keyboard shortcut definition cannot contain two final keys. Got "${expectedKey}" and "${rawKey}"; only the first one will be included.`,
          ),
        );
        break;
      }
      expectedKey = key;
    }

    if (treatAltGraphAsAltPlusCtrl && isAltGraphExpected) {
      if (expectedStates.ctrl === _ExpectedModifierKeySide.Right) {
        console.error(
          new Error(
            `DKT-NF0032: A keyboard shortcut definition that treats AltGraph as Alt+Ctrl cannot expect the user to press AltGraph and ControlRight keys (while not pressing ControlLeft), as pressing AltGraph automatically presses ControlLeft.`,
          ),
        );
      }
      expectedStates.ctrl = _ExpectedModifierKeySide.Left;
    }

    return this._shortcutSubject$.pipe(
      filter((shortcut) => {
        if (isModifierKeyInWrongState(shortcut.ctrl, expectedStates.ctrl))
          return false;
        if (isModifierKeyInWrongState(shortcut.alt, expectedStates.alt))
          return false;
        if (isModifierKeyInWrongState(shortcut.shift, expectedStates.shift))
          return false;
        if (isModifierKeyInWrongState(shortcut.meta, expectedStates.meta))
          return false;
        if (shortcut.key !== expectedKey) return false;
        return true;
      }),
      map((v) => v.publicData),
    );
  }
  listenToKey(code: string): Observable<KeyboardKey> {
    const keyStr = this._demapKeyCode(code);
    return this.anyKeyPress$.pipe(filter((key) => key.key == keyStr));
  }
  listenToKeyState(code: string): Observable<KeyboardKeyState> {
    const keyStr = this._demapKeyCode(code);
    return this.anyKeyState$.pipe(filter((key) => key.key == keyStr));
  }

  private readonly _KEY_CODE_SIGNALS_MAP = new Map<
    string,
    WritableSignal<boolean>
  >([
    ['ControlLeft', this._isLeftCtrlHeld],
    ['ControlRight', this._isRightCtrlHeld],
    ['AltLeft', this._isLeftAltHeld],
    ['AltRight', this._isRightAltHeld],
    ['ShiftLeft', this._isLeftShiftHeld],
    ['ShiftRight', this._isRightShiftHeld],
    ['MetaLeft', this._isLeftMetaHeld],
    ['MetaRight', this._isRightMetaHeld],
  ]);

  private _onKeydown(event: KeyboardEvent): void {
    let wasModifierKey = false;
    const modifierSignal = this._KEY_CODE_SIGNALS_MAP.get(event.code);
    if (modifierSignal) {
      wasModifierKey = true;
      modifierSignal.set(true);
    }

    this._updateLockKeyStates(event);

    this._emitKeyStateDown(event);
    if (!wasModifierKey && this.isAnyModifierKeyHeld()) {
      this._emitShortcut(event);
    } else this._emitKeydown(event);
  }
  private _updateLockKeyStates(event: KeyboardEvent): void {
    this._capsLockState.set(event.getModifierState?.('CapsLock'));
    this._numLockState.set(event.getModifierState?.('NumLock'));
    this._scrollLockState.set(event.getModifierState?.('ScrollLock'));
  }

  private _onKeyup(event: KeyboardEvent): void {
    const modifierSignal = this._KEY_CODE_SIGNALS_MAP.get(event.code);
    modifierSignal?.set(false);

    this._emitKeyStateUp(event);
  }
}
