import { ElementRef } from '@angular/core';

/**
 * Gets the content rect of an HTMLElement or ElementRef<HTMLElement>. Does not work in SSR environments.
 * @param el The HTMLElement or ElementRef<HTMLElement> to get the content rect for.
 * @returns A DOMRect representing the content rect of the element.
 */
export function getDomContentRect(
  el: HTMLElement | ElementRef<HTMLElement>,
): DOMRect {
  if (el instanceof ElementRef) el = el.nativeElement;

  const elRect = el.getBoundingClientRect();
  const [topPadd, rightPadd, bottomPadd, leftPadd] = getFourWayValue(
    el,
    'padding',
  );
  const [topBorder, rightBorder, bottomBorder, leftBorder] = getFourWayValue(
    el,
    'border-width',
  );

  return new DOMRect(
    elRect.x + leftPadd + leftBorder,
    elRect.y + topPadd + topBorder,
    elRect.width - leftPadd - rightPadd - leftBorder - rightBorder,
    elRect.height - topPadd - bottomPadd - topBorder - bottomBorder,
  );
}

/**
 * Gets the padding rect of an HTMLElement or ElementRef<HTMLElement>. Does not work in SSR environments.
 * @param el The HTMLElement or ElementRef<HTMLElement> to get the padding rect for.
 * @returns A DOMRect representing the padding rect of the element.
 */
export function getDomPaddingRect(
  el: HTMLElement | ElementRef<HTMLElement>,
): DOMRect {
  if (el instanceof ElementRef) el = el.nativeElement;

  const elRect = el.getBoundingClientRect();
  const [topBorder, rightBorder, bottomBorder, leftBorder] = getFourWayValue(
    el,
    'border-width',
  );

  return new DOMRect(
    elRect.x + leftBorder,
    elRect.y + topBorder,
    elRect.width - leftBorder - rightBorder,
    elRect.height - topBorder - bottomBorder,
  );
}

function getFourWayValue(
  el: HTMLElement,
  v: string,
): [number, number, number, number] {
  const elValues = window.getComputedStyle(el).getPropertyValue(v);
  const values = elValues.split(' ').map((v) => (v ? parseFloat(v) : null));
  const topValue = values[0] ?? 0;
  const rightValue = values[1] ?? topValue;
  const bottomValue = values[2] ?? topValue;
  const leftValue = values[3] ?? rightValue ?? topValue;

  return [topValue, rightValue, bottomValue, leftValue];
}
