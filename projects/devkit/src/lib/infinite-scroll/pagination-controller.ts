import {
  effect,
  inject,
  Injector,
  ResourceRef,
  ResourceStatus,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { from, Observable } from 'rxjs';
import { isPromise } from 'simple-bool';
import { counterSignal } from '../signals/counter';

export interface PaginationControllerOptions {
  pageSize: number;
  indexFromZero?: boolean;
  injector?: Injector;
  cache?: boolean;
}

export type PaginationControllerFetchFn<T> = (
  page: number,
  pageSize: number,
) => Promise<T[]> | Observable<T[]>;

export class PaginationController<T> {
  private readonly _injector: Injector;
  private readonly _indexFromZero: boolean = true;
  private readonly _shouldCache: boolean = true;

  private readonly _cache = new Map<number, T[]>();

  private readonly _currentPage = counterSignal(0);
  public readonly currentPage = this._currentPage.asReadonly();

  private readonly _pageSize = signal<number>(0);
  public readonly pageSize = this._pageSize.asReadonly();

  private readonly _itemsResource: ResourceRef<T[]>;

  public readonly items: ResourceRef<T[]>['value'];
  public readonly status: ResourceRef<T[]>['status'];
  public readonly error: ResourceRef<T[]>['error'];
  public readonly isLoading: ResourceRef<T[]>['isLoading'];
  public readonly hasValue: ResourceRef<T[]>['hasValue'];

  constructor(
    private readonly fetchFn: PaginationControllerFetchFn<T>,
    options: PaginationControllerOptions,
  ) {
    this._pageSize.set(options.pageSize);

    this._injector = options.injector ?? inject(Injector);

    if (options.indexFromZero !== undefined) {
      this._indexFromZero = options.indexFromZero;
      if (!this._indexFromZero) {
        this._currentPage.setBaseValue(1);
      }
    }

    this._itemsResource = rxResource({
      request: () => ({
        page: this._currentPage(),
        pageSize: this._pageSize(),
      }),
      loader: ({ request }) => {
        if (this._shouldCache && this._cache.has(request.page)) {
          return from(Promise.resolve(this._cache.get(request.page)!));
        }
        const fetchResult = this.fetchFn(request.page, request.pageSize);
        const fetchObservable = isPromise(fetchResult)
          ? from(fetchResult)
          : fetchResult;
        return fetchObservable;
      },
      injector: this._injector,
    });

    this.items = this._itemsResource.value;
    this.status = this._itemsResource.status;
    this.error = this._itemsResource.error;
    this.isLoading = this._itemsResource.isLoading;
    this.hasValue = this._itemsResource.hasValue;

    if (options.cache !== undefined) {
      this._shouldCache = options.cache;

      if (this._shouldCache) {
        effect(
          () => {
            const page = this._currentPage();
            this._pageSize();
            const status = this._itemsResource.status();

            if (status === ResourceStatus.Resolved) {
              const items = this._itemsResource.value();
              this._cache.set(page, items!);
            }
          },
          {
            injector: this._injector,
          },
        );
      }
    }
  }

  public setPageSize(pageSize: number): void {
    this._pageSize.set(pageSize);
    this.reset();
  }

  public setPage(page: number): void {
    this._currentPage.set(page);
  }
  public nextPage(): void {
    this._currentPage.increment();
  }
  public previousPage(): void {
    this._currentPage.decrement();
  }

  public reset(): void {
    this._currentPage.reset();
    this._cache.clear();
  }

  public destroy(): void {
    this._itemsResource.destroy();
    this._cache.clear();
  }
}
