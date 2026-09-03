import {
  computed,
  effect,
  inject,
  Injector,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { counterSignal } from '../signals/counter';
import { mapSignal } from '../signals/map';

export interface InfinitePagerOptions {
  pageSize: number;
  indexFromZero?: boolean;
}

export type InfinitePagerFetchFn<T, TMeta = unknown> = (
  page: number,
  pageSize: number,
) =>
  | Promise<InfinitePagerResult<T, TMeta>>
  | Observable<InfinitePagerResult<T, TMeta>>;

export interface InfinitePagerResult<T, TMeta = unknown> {
  items: T[];
  totalItems: number;
  meta?: TMeta | null;
}

export const InfinitePagerStatus = {
  Idle: 'idle',
  Loading: 'loading',
  Error: 'error',
  Exhausted: 'exhausted',
} as const;
export type InfinitePagerStatus =
  (typeof InfinitePagerStatus)[keyof typeof InfinitePagerStatus];

export interface InfinitePager<T, TMeta = unknown> {
  readonly currentPage: Signal<number>;
  readonly totalItems: Signal<number>;
  readonly items: Signal<readonly T[]>;
  readonly meta: Signal<TMeta | null>;

  readonly status: Signal<InfinitePagerStatus>;
  readonly error: Signal<unknown>;

  readonly isLoading: Signal<boolean>;
  readonly isExhausted: Signal<boolean>;
  readonly hasMore: Signal<boolean>;

  nextPage(): boolean;
  reset(): void;
  retry(): boolean;
}

export class InfinitePager<T, TMeta> implements InfinitePager<T, TMeta> {
  protected readonly _pageSize: number = 0;
  protected readonly _indexFromZero: boolean = true;

  protected readonly _currentPage = counterSignal(0);
  public readonly currentPage =
    this._currentPage.asReadonly() as Signal<number>;

  protected readonly _totalItems = signal<number>(0);
  public readonly totalItems = this._totalItems.asReadonly();

  protected readonly _meta = signal<TMeta | null>(null);
  public readonly meta = this._meta.asReadonly();

  protected readonly _pageItemsMap = mapSignal<number, T[]>();

  protected readonly _status = signal<InfinitePagerStatus>(
    InfinitePagerStatus.Idle,
  );
  public readonly status = this._status.asReadonly();

  protected readonly _error = signal<unknown>(null);
  public readonly error = this._error.asReadonly();

  public readonly isLoading = computed(
    () => this._status() === InfinitePagerStatus.Loading,
  );
  public readonly isExhausted = computed(
    () => this._status() === InfinitePagerStatus.Exhausted,
  );
  public readonly hasMore = computed(() => !this.isExhausted());
  public readonly isEmpty = computed(
    () =>
      this.totalItems() === 0 &&
      this._pageItemsMap.get(this._currentPage())?.length === 0,
  );

  public readonly items = computed(() => {
    const itemsMap = this._pageItemsMap();
    const items: T[] = [];
    for (let page = 0; page <= this._currentPage(); page++) {
      const pageItems = itemsMap.get(page);
      if (pageItems) {
        items.push(...pageItems);
      }
    }
    return items as readonly T[];
  });

  constructor(
    protected readonly fetchFn: InfinitePagerFetchFn<T, TMeta>,
    options: InfinitePagerOptions,
  ) {
    if (options.indexFromZero !== undefined) {
      this._indexFromZero = options.indexFromZero;
      this._currentPage.set(this._indexFromZero ? 0 : 1);
      this._currentPage.setBaseValue(this._indexFromZero ? 0 : 1);
    }
    this._pageSize = options.pageSize;

    this._fetchPage(this._currentPage(), this._pageSize);
  }

  protected requestId = 0;
  protected async _fetchPage(page: number, pageSize: number): Promise<void> {
    const currentRequestId = ++this.requestId;
    this._status.set(InfinitePagerStatus.Loading);

    const fetchResult = this.fetchFn(page, pageSize);
    const fetchPromise =
      fetchResult instanceof Promise
        ? fetchResult
        : firstValueFrom(fetchResult);

    try {
      const result = await fetchPromise;
      if (currentRequestId !== this.requestId) return;

      this._pageItemsMap.setKey(page, result.items);
      this._totalItems.set(result.totalItems);
      this._meta.set(result.meta ?? null);
      this._status.set(
        result.items.length < pageSize
          ? InfinitePagerStatus.Exhausted
          : InfinitePagerStatus.Idle,
      );
    } catch (error) {
      if (currentRequestId !== this.requestId) return;
      this._error.set(error);
      this._status.set(InfinitePagerStatus.Error);
    }
  }

  public nextPage(): boolean {
    if (this._status() === InfinitePagerStatus.Loading) return false;

    this._currentPage.increment();
    void this._fetchPage(this._currentPage(), this._pageSize);
    return true;
  }

  public reset(): void {
    this._currentPage.reset();
    this._totalItems.set(0);
    this._pageItemsMap.clear();
    this._status.set(InfinitePagerStatus.Idle);
    this._error.set(null);
    this._fetchPage(this._currentPage(), this._pageSize);
  }

  public retry(): boolean {
    if (this._status() === InfinitePagerStatus.Loading) return false;

    void this._fetchPage(this._currentPage(), this._pageSize);
    return true;
  }
}

export interface FilteredInfinitePagerOptions<F> extends InfinitePagerOptions {
  cache?: boolean;
  injector?: Injector;
  createCacheKey?: (filter: F) => string;
}

export interface FilteredInfinitePager<T, F, TMeta = unknown>
  extends InfinitePager<T, TMeta> {
  readonly filter: Signal<F>;
  setFilter(filter: F): void;
}

export type FilteredInfinitePagerFetchFn<T, F, TMeta = unknown> = (
  page: number,
  pageSize: number,
  filter: F,
) =>
  | Promise<InfinitePagerResult<T, TMeta>>
  | Observable<InfinitePagerResult<T, TMeta>>;

export class FilteredInfinitePager<T, F, TMeta = unknown>
  extends InfinitePager<T, TMeta>
  implements FilteredInfinitePager<T, F>
{
  protected readonly _shouldCache: boolean = true;
  protected readonly _injector: Injector;
  protected readonly _createCacheKey: (filter: F) => string = (filter: F) =>
    JSON.stringify(filter);

  protected readonly _filter = signal<F>(null as unknown as F);
  public readonly filter = this._filter.asReadonly();

  protected readonly _filteredCachedPages = new Map<
    string,
    Map<number, { items: T[]; totalItems: number; meta: TMeta }>
  >();

  constructor(
    protected readonly _fetchFn: FilteredInfinitePagerFetchFn<T, F, TMeta>,
    options: FilteredInfinitePagerOptions<F>,
  ) {
    super((page, pageSize) => this._customFetchFn(page, pageSize), options);
    this._shouldCache = options.cache ?? true;
    this._injector = options.injector ?? inject(Injector);
  }

  public setFilter(filter: F): void {
    this._filter.set(filter);
    this.reset();
  }

  protected _customFetchFn(
    page: number,
    pageSize: number,
  ):
    | Promise<InfinitePagerResult<T, TMeta>>
    | Observable<InfinitePagerResult<T, TMeta>> {
    const cacheKey = this._createCacheKey(this._filter());
    if (this._shouldCache && this._filteredCachedPages.has(cacheKey)) {
      const cachedPages = this._filteredCachedPages.get(cacheKey)!;
      if (cachedPages.has(page)) {
        const cachedResult = cachedPages.get(page)!;
        return Promise.resolve({
          items: cachedResult.items,
          totalItems: cachedResult.totalItems,
          meta: cachedResult.meta,
        });
      }
    }

    const fetchResult = (
      this._fetchFn as FilteredInfinitePagerFetchFn<T, F, TMeta>
    )(page, pageSize, this._filter());

    if (this._shouldCache) {
      const cache =
        this._filteredCachedPages.get(cacheKey) ??
        new Map<number, { items: T[]; totalItems: number; meta: TMeta }>();
      this._filteredCachedPages.set(cacheKey, cache);
    }

    return fetchResult;
  }
}

export interface InfinitePagerFeature<TAdded = {}> {
  <P extends InfinitePagerFeatureTarget>(pager: P): P & TAdded;

  /**
   * Type-only marker. Never assigned at runtime.
   */
  readonly __addedType?: TAdded;
}

type AddedType<TFeature> =
  TFeature extends InfinitePagerFeature<infer TAdded> ? TAdded : {};

type ApplyInfinitePagerFeatures<
  TPager,
  TFeatures extends readonly InfinitePagerFeature<any>[],
> = TFeatures extends readonly [infer TFeature, ...infer TRest]
  ? TRest extends readonly InfinitePagerFeature<any>[]
    ? ApplyInfinitePagerFeatures<TPager & AddedType<TFeature>, TRest>
    : TPager & AddedType<TFeature>
  : TPager;

export function decorateInfinitePager<
  TPager extends InfinitePagerFeatureTarget,
  const TFeatures extends readonly InfinitePagerFeature<any>[],
>(
  pager: TPager,
  features: TFeatures,
): ApplyInfinitePagerFeatures<TPager, TFeatures> {
  let result: InfinitePagerFeatureTarget = pager;

  for (const feature of features) {
    result = feature(result);
  }

  return result as ApplyInfinitePagerFeatures<TPager, TFeatures>;
}

export interface InfinitePagerFeatureTarget {
  readonly status: Signal<InfinitePagerStatus>;
  readonly error: Signal<unknown>;

  nextPage(): boolean;
  reset(): void;
}

export function withErrorSnackbar(
  showError: (error: unknown) => void,
  injector: Injector = inject(Injector),
) {
  return <P extends InfinitePagerFeatureTarget>(pager: P): P => {
    effect(
      () => {
        if (pager.status() !== InfinitePagerStatus.Error) {
          return;
        }

        const error = pager.error();

        untracked(() => {
          showError(error);
        });
      },
      {
        injector,
      },
    );

    return pager;
  };
}
