import { mapSignal, MapSignal, WritableMapSignal } from './map-signal';

describe('mapSignal', () => {
  let signal: WritableMapSignal<string, number>;
  const initialEntries: [string, number][] = [
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ];

  beforeEach(() => {
    signal = mapSignal<string, number>(initialEntries);
  });

  describe('isEmpty', () => {
    it('should be false for a non-empty map', () => {
      expect(signal.isEmpty()).toBe(false);
    });

    it('should be true after clearing the map', () => {
      signal.clear();
      expect(signal.isEmpty()).toBe(true);
    });

    it('should update automatically when entries are added', () => {
      const empty = mapSignal<string, number>();
      expect(empty.isEmpty()).toBe(true);
      empty.setKey('x', 42);
      expect(empty.isEmpty()).toBe(false);
    });

    it('should update automatically when entries are removed', () => {
      const s = mapSignal<string, number>([['x', 1]]);
      expect(s.isEmpty()).toBe(false);
      s.delete('x');
      expect(s.isEmpty()).toBe(true);
    });
  });

  describe('size', () => {
    it('should return the correct size', () => {
      expect(signal.size()).toBe(3);
      signal.setKey('d', 4);
      expect(signal.size()).toBe(4);
      signal.delete('a');
      expect(signal.size()).toBe(3);
    });
  });

  describe('has', () => {
    it('should check for existence', () => {
      expect(signal.has('b')).toBe(true);
      expect(signal.has('zzz')).toBe(false);
    });
    it('should update after delete/add', () => {
      signal.delete('b');
      expect(signal.has('b')).toBe(false);
      signal.setKey('b', 7);
      expect(signal.has('b')).toBe(true);
    });
  });

  describe('get', () => {
    it('should get the value for an existing key', () => {
      expect(signal.get('a')).toBe(1);
      expect(signal.get('c')).toBe(3);
    });
    it('should return undefined for non-existent key', () => {
      expect(signal.get('not-there')).toBeUndefined();
    });
  });

  describe('setKey and set', () => {
    it('should add a new entry', () => {
      signal.setKey('d', 4);
      expect(signal.get('d')).toBe(4);
      expect(signal.size()).toBe(4);
    });

    it('should update existing entry', () => {
      signal.setKey('b', 99);
      expect(signal.get('b')).toBe(99);
      expect(signal.size()).toBe(3);
    });

    it('should support set alias', () => {
      signal.set('e', 5);
      expect(signal.get('e')).toBe(5);
      expect(signal.size()).toBe(4);
    });
  });

  describe('delete', () => {
    it('should remove existing entry and return true', () => {
      expect(signal.delete('b')).toBe(true);
      expect(signal.has('b')).toBe(false);
    });

    it('should do nothing for non-existent entry and return false', () => {
      expect(signal.delete('never-there')).toBe(false);
      expect(signal.size()).toBe(3);
    });
  });

  describe('merge', () => {
    it('should merge new entries into the map', () => {
      signal.merge([
        ['d', 4],
        ['e', 5],
      ]);
      expect(signal.entriesArray()).toEqual([
        ['a', 1],
        ['b', 2],
        ['c', 3],
        ['d', 4],
        ['e', 5],
      ]);
    });

    it('should overwrite existing entries', () => {
      signal.merge([
        ['b', 102],
        ['c', 103],
      ]);
      expect(signal.entriesArray()).toEqual([
        ['a', 1],
        ['b', 102],
        ['c', 103],
      ]);
    });
  });

  describe('toggleKey', () => {
    it('should add the key if it does not exist', () => {
      signal.toggleKey('d', 4);
      expect(signal.has('d')).toBe(true);
      expect(signal.get('d')).toBe(4);
    });

    it('should remove the key if it exists', () => {
      signal.toggleKey('b', 99);
      expect(signal.has('b')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should empty the map', () => {
      signal.clear();
      expect(signal()).toEqual(new Map());
      expect(signal.size()).toBe(0);
      expect(signal.isEmpty()).toBe(true);
    });
  });

  describe('setMap and set', () => {
    it('should replace with new map using setMap', () => {
      signal.setMap(
        new Map([
          ['z', 9],
          ['y', 8],
        ]),
      );
      expect(signal.entriesArray()).toEqual([
        ['z', 9],
        ['y', 8],
      ]);
    });

    it('should replace with new map using set (alias)', () => {
      signal.set(new Map([['k', 5]]));
      expect(signal.entriesArray()).toEqual([['k', 5]]);
    });

    it('should deep clone the value', () => {
      const m = new Map([['k', 1]]);
      signal.setMap(m);
      m.set('k', 999);
      expect(signal.entriesArray()).toEqual([['k', 1]]);
    });
  });

  describe('asReadonly', () => {
    let readonly: MapSignal<string, number>;

    beforeEach(() => {
      readonly = signal.asReadonly();
    });

    it('should reflect internal updates', () => {
      signal.setKey('z', 10);
      expect(readonly.entriesArray()).toEqual([
        ['a', 1],
        ['b', 2],
        ['c', 3],
        ['z', 10],
      ]);
    });

    it('should reflect isEmpty state', () => {
      expect(readonly.isEmpty()).toBe(false);
      signal.clear();
      expect(readonly.isEmpty()).toBe(true);
    });

    it('should reflect size', () => {
      expect(readonly.size()).toBe(3);
      signal.setKey('h', 77);
      expect(readonly.size()).toBe(4);
    });

    it('should provide get and has', () => {
      expect(readonly.get('a')).toBe(1);
      expect(readonly.has('a')).toBe(true);
      expect(readonly.get('nope')).toBeUndefined();
      expect(readonly.has('nope')).toBe(false);
    });
  });

  describe('update', () => {
    it('should receive the current map and return a new one', () => {
      signal.update((map) => {
        const next = new Map(map);
        next.set('q', 99);
        return next;
      });
      expect(signal.get('q')).toBe(99);
    });

    it('should support empty map update', () => {
      const empty = mapSignal<string, number>();
      empty.update(() => new Map([['xx', 7]]));
      expect(empty.get('xx')).toBe(7);
    });
  });

  describe('updateAt', () => {
    it('should update the value for the key using update function', () => {
      signal.updateAt('a', (current) => current * 2);
      expect(signal.get('a')).toBe(2);
    });

    it('should do nothing if the key does not exist', () => {
      signal.updateAt('nope', (current) => 42);
      expect(signal.has('nope')).toBe(false);
    });
  });

  describe('entriesArray', () => {
    it('should return an array of entries', () => {
      expect(signal.entriesArray()).toEqual([
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ]);
    });
    it('should update after setKey/delete', () => {
      signal.setKey('z', 100);
      signal.delete('a');
      expect(signal.entriesArray()).toEqual([
        ['b', 2],
        ['c', 3],
        ['z', 100],
      ]);
    });
  });

  describe('keysArray', () => {
    it('should return an array of keys', () => {
      expect(signal.keysArray()).toEqual(['a', 'b', 'c']);
    });
    it('should update after changes', () => {
      signal.setKey('m', 5);
      signal.delete('b');
      expect(signal.keysArray()).toEqual(['a', 'c', 'm']);
    });
  });

  describe('valuesArray', () => {
    it('should return an array of values', () => {
      expect(signal.valuesArray()).toEqual([1, 2, 3]);
    });
    it('should update after changes', () => {
      signal.setKey('x', 42);
      signal.delete('c');
      expect(signal.valuesArray()).toEqual([1, 2, 42]);
    });
  });
});
