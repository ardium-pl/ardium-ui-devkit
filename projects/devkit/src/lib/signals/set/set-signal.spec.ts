import { setSignal, SetSignal, WritableSetSignal } from './set-signal';

describe('SetSignal', () => {
  let signal: WritableSetSignal<number>;
  const originalSet = new Set([1, 2, 3]);

  beforeEach(() => {
    signal = setSignal([...originalSet]);
  });

  describe('isEmpty', () => {
    it('should be false for a non-empty set', () => {
      expect(signal.isEmpty()).toBe(false);
    });

    it('should be true after clearing the set', () => {
      signal.clear();
      expect(signal.isEmpty()).toBe(true);
    });

    it('should update automatically when items are added', () => {
      const empty = setSignal<number>();
      expect(empty.isEmpty()).toBe(true);
      empty.add(42);
      expect(empty.isEmpty()).toBe(false);
    });

    it('should update automatically when items are deleted', () => {
      const s = setSignal<number>([10]);
      expect(s.isEmpty()).toBe(false);
      s.delete(10);
      expect(s.isEmpty()).toBe(true);
    });
  });

  describe('size', () => {
    it('should return the correct size', () => {
      expect(signal.size()).toBe(3);
      signal.add(4);
      expect(signal.size()).toBe(4);
      signal.delete(1);
      expect(signal.size()).toBe(3);
    });
  });

  describe('has', () => {
    it('should check for existence', () => {
      expect(signal.has(2)).toBe(true);
      expect(signal.has(999)).toBe(false);
    });
    it('should update after delete/add', () => {
      expect(signal.has(2)).toBe(true);
      signal.delete(2);
      expect(signal.has(2)).toBe(false);
      signal.add(2);
      expect(signal.has(2)).toBe(true);
    });
  });

  describe('add', () => {
    it('should add a new item', () => {
      signal.add(5);
      expect(signal.has(5)).toBe(true);
      expect(signal.size()).toBe(4);
    });

    it('should not add duplicates', () => {
      signal.add(3);
      expect(signal.size()).toBe(3);
      expect(Array.from(signal())).toEqual([1, 2, 3]);
    });
  });

  describe('delete', () => {
    it('should remove existing item and return true', () => {
      expect(signal.delete(2)).toBe(true);
      expect(signal.has(2)).toBe(false);
    });

    it('should do nothing for non-existent item and return false', () => {
      expect(signal.delete(99)).toBe(false);
      expect(signal.size()).toBe(3);
    });
  });

  describe('toggle', () => {
    it('should add item if not present and return true', () => {
      expect(signal.toggle(99)).toBe(true);
      expect(signal.has(99)).toBe(true);
    });

    it('should remove item if present and return false', () => {
      signal.add(2);
      expect(signal.has(2)).toBe(true);
      expect(signal.toggle(2)).toBe(false);
      expect(signal.has(2)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should empty the set', () => {
      signal.clear();
      expect(signal()).toEqual(new Set());
      expect(signal.size()).toBe(0);
      expect(signal.isEmpty()).toBe(true);
    });
  });

  describe('set', () => {
    it('should replace with new set', () => {
      signal.set(new Set([9, 8]));
      expect(signal()).toEqual(new Set([9, 8]));
    });

    it('should deep clone the set', () => {
      const set = new Set([1, 2]);
      signal.set(set);
      set.add(99);
      expect(signal()).toEqual(new Set([1, 2]));
    });
  });

  describe('asReadonly', () => {
    let readonly: SetSignal<number>;

    beforeEach(() => {
      readonly = signal.asReadonly();
    });

    it('should reflect internal updates', () => {
      signal.add(4);
      expect(readonly()).toEqual(new Set([1, 2, 3, 4]));
    });

    it('should reflect isEmpty state', () => {
      expect(readonly.isEmpty()).toBe(false);
      signal.clear();
      expect(readonly.isEmpty()).toBe(true);
    });

    it('should reflect size', () => {
      expect(readonly.size()).toBe(3);
      signal.add(99);
      expect(readonly.size()).toBe(4);
    });
  });

  describe('asArray', () => {
    it('should return an array of set elements', () => {
      const arr = signal.asArray();
      expect(arr.sort()).toEqual([1, 2, 3]);
    });
    it('should update after add/delete', () => {
      signal.add(7);
      signal.delete(1);
      expect(signal.asArray().sort()).toEqual([2, 3, 7]);
    });
  });

  describe('update', () => {
    it('should receive the current set and return a new one', () => {
      signal.update((set) => {
        const next = new Set(set);
        next.add(99);
        return next;
      });
      expect(signal.has(99)).toBe(true);
    });

    it('should support empty set update', () => {
      const empty = setSignal<number>();
      empty.update(() => new Set([1]));
      expect(empty()).toEqual(new Set([1]));
    });
  });
});
