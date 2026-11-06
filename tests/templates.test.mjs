import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { validateTemplate, instantiateTemplate } from '../dist/esm/index.js';
const object = (id, kind, value, locked = false) => ({
  id,
  kind,
  value,
  locked,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});
const template = () => ({
  width: 100,
  height: 100,
  objects: [
    object('title', 'text', 'Default'),
    object('background', 'shape', '#FFFFFF', true),
    object('logo', 'asset', 'default-logo'),
  ],
  slots: [
    { name: 'heading', objectId: 'title', required: true, maxLength: 20 },
    { name: 'mark', objectId: 'logo', required: false },
  ],
});
test('bindings produce exact document and preserve locked objects', () => {
  const result = instantiateTemplate(template(), { heading: 'Hello 😀', mark: 'brand-logo' });
  assert.deepEqual(result, {
    width: 100,
    height: 100,
    objects: [
      object('title', 'text', 'Hello 😀'),
      object('background', 'shape', '#FFFFFF', true),
      object('logo', 'asset', 'brand-logo'),
    ],
  });
});
test('optional values keep defaults and empty required string is a supplied value', () => {
  const result = instantiateTemplate(template(), { heading: '' });
  assert.deepEqual(
    result.objects.map((o) => o.value),
    ['', '#FFFFFF', 'default-logo'],
  );
});
test('snapshots are independent of input and one another', () => {
  const input = template(),
    validated = validateTemplate(input),
    doc = instantiateTemplate(input, { heading: 'A' });
  input.objects[0].value = 'Changed';
  doc.objects[1].value = '#000000';
  assert.equal(validated.objects[0].value, 'Default');
  assert.equal(validated.objects[1].value, '#FFFFFF');
  assert.equal(instantiateTemplate(validated, { heading: 'B' }).objects[1].value, '#FFFFFF');
});
test('locked missing duplicate and multiply bound slot targets reject', () => {
  for (const objectId of ['background', 'missing']) {
    const input = template();
    input.slots[0].objectId = objectId;
    assert.throws(() => validateTemplate(input), TypeError);
  }
  const input = template();
  input.slots.push({ name: 'other', objectId: 'title', required: false });
  assert.throws(() => validateTemplate(input), TypeError);
  input.slots.pop();
  input.slots[1].name = 'heading';
  assert.throws(() => validateTemplate(input), TypeError);
  input.slots.pop();
  input.objects[1].id = 'title';
  assert.throws(() => validateTemplate(input), TypeError);
});
test('unknown missing bindings and nonstrings reject', () => {
  assert.throws(() => instantiateTemplate(template(), {}), /Missing required slot/);
  assert.throws(() => instantiateTemplate(template(), { heading: 'A', extra: 'B' }), TypeError);
  assert.throws(() => instantiateTemplate(template(), { heading: 42 }), TypeError);
});
test('markup and interpreted asset/color inputs cannot enter output', () => {
  for (const heading of ['<script>x</script>', '<b>x</b>', 'x\u0000'])
    assert.throws(() => instantiateTemplate(template(), { heading }), TypeError);
  for (const mark of ['https://example.test/a.png', 'data:image/svg+xml', '../logo'])
    assert.throws(() => instantiateTemplate(template(), { heading: 'A', mark }), TypeError);
  const input = template();
  input.objects[1].locked = false;
  input.slots.push({ name: 'fill', objectId: 'background', required: false });
  assert.equal(
    instantiateTemplate(input, { heading: 'A', fill: '#12345678' }).objects[1].value,
    '#12345678',
  );
  assert.throws(
    () => instantiateTemplate(input, { heading: 'A', fill: 'url(javascript:x)' }),
    TypeError,
  );
});
test('own data only with no getter invocation or unsafe paths', () => {
  let calls = 0;
  const data = {
    get heading() {
      calls++;
      return 'A';
    },
  };
  assert.throws(() => instantiateTemplate(template(), data), TypeError);
  assert.equal(calls, 0);
  assert.throws(() => instantiateTemplate(template(), JSON.parse('{"__proto__":"x"}')), TypeError);
  assert.throws(() => instantiateTemplate(template(), Object.create({ heading: 'A' })), TypeError);
  const input = template();
  input.slots[0].name = 'constructor';
  assert.throws(() => validateTemplate(input), TypeError);
});
test('geometry and schema violations reject', () => {
  for (const bad of [NaN, Infinity, -1]) {
    const input = template();
    input.objects[0].x = bad;
    assert.throws(() => validateTemplate(input), RangeError);
  }
  const input = template();
  input.objects[0].x = 95;
  assert.throws(() => validateTemplate(input), RangeError);
  input.objects[0].x = 0;
  input.objects[0].onClick = 'evil';
  assert.throws(() => validateTemplate(input), TypeError);
  const badLimit = template();
  badLimit.slots[0].maxLength = null;
  assert.throws(() => validateTemplate(badLimit), TypeError);
});
test('count slot and total text limits are enforced', () => {
  assert.throws(() => validateTemplate(template(), { maxObjects: 2 }), RangeError);
  assert.throws(() => validateTemplate(template(), { maxSlots: 1 }), RangeError);
  assert.throws(() => instantiateTemplate(template(), { heading: 'x'.repeat(21) }), RangeError);
  assert.throws(() => validateTemplate(template(), { maxTotalText: 10 }), RangeError);
  const input = template();
  input.slots[0].maxLength = 5;
  assert.throws(() => validateTemplate(input), RangeError);
  assert.throws(() => validateTemplate(template(), { maxTextLength: 0 }), RangeError);
});
test('independent object-value oracle covers repeated instantiations', () => {
  const input = template();
  for (let i = 0; i < 50; i++) {
    const heading = `Title ${i}`,
      mark = `mark-${i}`;
    const result = instantiateTemplate(input, { heading, mark });
    for (const expected of input.objects) {
      const output = result.objects.find((o) => o.id === expected.id);
      assert.deepEqual(output, {
        ...expected,
        value: expected.id === 'title' ? heading : expected.id === 'logo' ? mark : expected.value,
      });
    }
  }
});
test('CommonJS validates and binds the same data', () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.deepEqual(cjs.validateTemplate(template()), validateTemplate(template()));
  assert.deepEqual(
    cjs.instantiateTemplate(template(), { heading: 'A' }),
    instantiateTemplate(template(), { heading: 'A' }),
  );
});
