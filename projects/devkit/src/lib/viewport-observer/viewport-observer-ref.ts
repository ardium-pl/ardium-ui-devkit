import {
  computed,
  ElementRef,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { isNumber } from 'simple-bool';
import { RequireAtLeastOne, throttleSaveLast } from './utils';

enum ViewportRelation {
  Above = 'above',
  PartiallyAbove = 'partially-above',
  Inside = 'inside',
  PartiallyBelow = 'partially-below',
  Below = 'below',
  InsideButTooLarge = 'inside-too-large',
  Undefined = 'undefined',
}

interface TopBottom<T> {
  top: T;
  bottom: T;
}

class ViewportMargins implements TopBottom<WritableSignal<number>> {
  readonly top = signal<number>(0);
  readonly bottom = signal<number>(0);

  constructor(margin: ArdViewportObserverConfig['margin']) {
    if (isNumber(margin)) {
      this.top.set(margin);
      this.bottom.set(margin);
      return;
    }
    this.top.set(margin?.top ?? 0);
    this.bottom.set(margin?.bottom ?? 0);
  }
}

export interface ArdViewportObserverConfig {
  margin: number | RequireAtLeastOne<{ top: number; bottom: number }>;
  throttleTime: number;
}

export class ArdViewportObserverRef {
  public readonly element!: HTMLElement;
  constructor(
    element: HTMLElement | ElementRef<HTMLElement>,
    private readonly update$: Observable<void>,
    config: ArdViewportObserverConfig,
  ) {
    this.element =
      element instanceof ElementRef ? element.nativeElement : element;

    setTimeout(() => {
      this._updateViewportRelation();
    }, 0);

    this._throttleTime = config.throttleTime;
    this._margins = new ViewportMargins(config.margin);
    this.margins = {
      top: this._margins.top.asReadonly(),
      bottom: this._margins.bottom.asReadonly(),
    };

    this._scrollSubscription = this.update$
      .pipe(throttleSaveLast(this._throttleTime))
      .subscribe(() => this._updateViewportRelation());
  }
  private readonly _throttleTime!: number;
  private readonly _margins!: TopBottom<WritableSignal<number>>;
  public readonly margins!: {
    readonly top: Signal<number>;
    readonly bottom: Signal<number>;
  };
  private readonly _scrollSubscription!: Subscription;

  private readonly _rawPosition = signal<
    Readonly<TopBottom<number>> | undefined
  >(undefined);

  public readonly position = computed(() => {
    const pos = this._rawPosition();
    if (!pos) return undefined;
    return {
      top: pos.top - this._margins.top(),
      bottom: window.innerHeight - pos.bottom - this._margins.bottom(),
    };
  });
  
  public readonly viewportRelation = computed<ViewportRelation | undefined>(
    () => this._getNewRelation(this._rawPosition()),
  );
  public readonly isInViewport = computed(() =>
    this.viewportRelation() === ViewportRelation.Undefined
      ? undefined
      : this.viewportRelation() === ViewportRelation.Inside ||
        this.viewportRelation() === ViewportRelation.PartiallyAbove ||
        this.viewportRelation() === ViewportRelation.PartiallyBelow,
  );

  private _updateViewportRelation() {
    const rect = this.element.getBoundingClientRect();
    this._rawPosition.set({
      top: rect.top,
      bottom: rect.bottom,
    });
  }
  private _getNewRelation(rect: TopBottom<number> | undefined) {
    if (!rect) return undefined;
    const topThreshold = this._margins.top();
    if (rect.bottom <= topThreshold) {
      return ViewportRelation.Above;
    }
    if (rect.bottom > topThreshold && rect.top < topThreshold) {
      return ViewportRelation.PartiallyAbove;
    }
    const bottomThreshold = window.innerHeight - this._margins.bottom();
    if (rect.top > topThreshold && rect.bottom > bottomThreshold) {
      return ViewportRelation.InsideButTooLarge;
    }
    if (rect.top < bottomThreshold && rect.bottom > bottomThreshold) {
      return ViewportRelation.PartiallyBelow;
    }
    if (rect.top >= bottomThreshold) {
      return ViewportRelation.Below;
    }
    return ViewportRelation.Inside;
  }

  private readonly _isDestroyed = signal(false);
  public readonly isDestroyed = this._isDestroyed.asReadonly();

  public recheck(): void {
    this._updateViewportRelation();
  }

  public destroy(): void {
    if (this.isDestroyed()) return;
    this._isDestroyed.set(true);
    this._scrollSubscription.unsubscribe();
  }

  public setMargin(topAndBottom: number): ArdViewportObserverRef;
  public setMargin(top: number, bottom: number): ArdViewportObserverRef;
  public setMargin(top: number, bottom: number = top): ArdViewportObserverRef {
    this._margins.top.set(top);
    this._margins.bottom.set(bottom);
    this._updateViewportRelation();
    return this;
  }
}
