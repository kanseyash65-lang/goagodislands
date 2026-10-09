import { describe, expect, it } from 'vitest';
import { createRng, createStreams } from '../../core/rng/mulberry32';
import { KindRegistry } from '../definitions/kinds';
import { EntityManager } from '../entity-manager';
import { PropertyRegistry } from '../properties/property-registry';

describe('seeded RNG', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it('streams are independent', () => {
    const s = createStreams(7);
    expect(s.world.next()).not.toBe(s.cosmetic.next());
  });
});

describe('entity manager', () => {
  it('recycles ids through the free list', () => {
    const em = new EntityManager(4);
    const a = em.create(0, 1, 2);
    em.destroy(a);
    expect(em.create(0, 3, 4)).toBe(a);
    expect(em.count).toBe(1);
  });
  it('returns -1 when full instead of growing', () => {
    const em = new EntityManager(2);
    em.create(0, 0, 0);
    em.create(0, 0, 0);
    expect(em.create(0, 0, 0)).toBe(-1);
  });
});

describe('property registry', () => {
  const kinds = new KindRegistry();
  it('applies colour via inference', () => {
    const em = new EntityManager(4);
    const id = em.create(kinds.id('chicken'), 0, 0);
    const props = new PropertyRegistry();
    const v = { type: 'color', name: 'green', rgb: { r: 0, g: 1, b: 0 }, special: 'none' } as const;
    expect(props.inferFor(v)?.apply(em, id, v, createRng(1))).toBe(true);
    expect([em.tintR[id], em.tintG[id], em.tintB[id]]).toEqual([0, 1, 0]);
  });
  it('clamps relative sizes', () => {
    const em = new EntityManager(4);
    const id = em.create(0, 0, 0);
    const size = new PropertyRegistry().get('size');
    for (let i = 0; i < 20; i++) size?.apply(em, id, { type: 'size', factor: 2, relative: true, label: 'bigger' }, createRng(1));
    expect(em.scale[id]).toBe(8);
  });
});
