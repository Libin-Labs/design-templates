export interface DesignObject {
  id: string;
  kind: 'text' | 'shape' | 'asset';
  x: number;
  y: number;
  width: number;
  height: number;
  locked: boolean;
  value: string;
}
export interface TemplateSlot {
  name: string;
  objectId: string;
  required: boolean;
  maxLength?: number;
}
export interface DesignTemplate {
  width: number;
  height: number;
  objects: readonly DesignObject[];
  slots: readonly TemplateSlot[];
}
export interface DesignDocument {
  width: number;
  height: number;
  objects: DesignObject[];
}
export interface TemplateLimits {
  maxObjects?: number;
  maxSlots?: number;
  maxTextLength?: number;
  maxTotalText?: number;
}
function record(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new TypeError('Expected plain record');
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key) || (keys && !keys.includes(key)))
      throw new TypeError('Unsafe or unknown property');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor)) throw new TypeError('Accessors are unsupported');
    out[key] = descriptor.value;
  }
  if (Object.getOwnPropertySymbols(value).length)
    throw new TypeError('Symbol keys are unsupported');
  return out;
}
function identifier(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(value) ||
    ['constructor', 'prototype', '__proto__'].includes(value)
  )
    throw new TypeError('Invalid identifier');
  return value;
}
function number(value: unknown, positive = false): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    (positive && value === 0) ||
    value > 1e9
  )
    throw new RangeError('Invalid geometry');
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Expected boolean');
  return value;
}
function limit(value: number | undefined, fallback: number, ceiling: number): number {
  const n = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(n) || n < 1 || n > ceiling)
    throw new RangeError('Invalid template limit');
  return n;
}
function limitsFor(limits: TemplateLimits): {
  objects: number;
  slots: number;
  text: number;
  total: number;
} {
  return {
    objects: limit(limits.maxObjects, 1000, 1000),
    slots: limit(limits.maxSlots, 1000, 1000),
    text: limit(limits.maxTextLength, 10_000, 100_000),
    total: limit(limits.maxTotalText, 1_000_000, 1_000_000),
  };
}
function valueFor(kind: DesignObject['kind'], value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw new TypeError('Slot values must be strings');
  if (value.length > maxLength) throw new RangeError('Text limit exceeded');
  if (kind === 'shape') {
    if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value)) throw new TypeError('Expected hex fill');
  } else if (kind === 'asset') {
    identifier(value);
  } else if (/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) {
    throw new TypeError('Markup and control characters are unsupported');
  }
  return value;
}
/** Validates and snapshots the bounded schema. No HTML, URLs, script, or arbitrary property paths. */
export function validateTemplate(
  input: DesignTemplate,
  limits: TemplateLimits = {},
): DesignTemplate {
  const bounds = limitsFor(limits);
  const template = record(input, ['width', 'height', 'objects', 'slots']);
  const width = number(template.width, true),
    height = number(template.height, true);
  if (
    !Array.isArray(template.objects) ||
    template.objects.length > bounds.objects ||
    !Array.isArray(template.slots) ||
    template.slots.length > bounds.slots
  )
    throw new RangeError('Template count limit exceeded');
  const ids = new Set<string>();
  let total = 0;
  const objects: DesignObject[] = template.objects.map((input: unknown) => {
    const object = record(input, ['id', 'kind', 'x', 'y', 'width', 'height', 'locked', 'value']);
    const id = identifier(object.id);
    if (ids.has(id)) throw new TypeError('Duplicate object id');
    ids.add(id);
    const kind = object.kind;
    if (kind !== 'text' && kind !== 'shape' && kind !== 'asset')
      throw new TypeError('Invalid object kind');
    const x = number(object.x),
      y = number(object.y),
      w = number(object.width),
      h = number(object.height);
    if (x + w > width || y + h > height) throw new RangeError('Object outside canvas');
    const value = valueFor(kind, object.value, bounds.text);
    total += value.length;
    if (total > bounds.total) throw new RangeError('Total text limit exceeded');
    return { id, kind, x, y, width: w, height: h, locked: boolean(object.locked), value };
  });
  const names = new Set<string>();
  const boundObjects = new Set<string>();
  const slots: TemplateSlot[] = template.slots.map((input: unknown) => {
    const slot = record(input, ['name', 'objectId', 'required', 'maxLength']);
    const name = identifier(slot.name),
      objectId = identifier(slot.objectId);
    const object = objects.find((object) => object.id === objectId);
    if (names.has(name) || boundObjects.has(objectId) || !object || object.locked)
      throw new TypeError('Duplicate, missing, or locked slot target');
    names.add(name);
    boundObjects.add(objectId);
    const required = boolean(slot.required);
    if (slot.maxLength !== undefined && typeof slot.maxLength !== 'number') {
      throw new TypeError('maxLength must be a number');
    }
    const maxLength =
      slot.maxLength === undefined
        ? undefined
        : limit(slot.maxLength as number, bounds.text, bounds.text);
    if (maxLength !== undefined && object.value.length > maxLength)
      throw new RangeError('Default exceeds slot limit');
    return { name, objectId, required, ...(maxLength === undefined ? {} : { maxLength }) };
  });
  return { width, height, objects, slots };
}
export function instantiateTemplate(
  input: DesignTemplate,
  bindings: Readonly<Record<string, string>>,
  limits: TemplateLimits = {},
): DesignDocument {
  const template = validateTemplate(input, limits);
  const bounds = limitsFor(limits);
  const data = record(
    bindings,
    template.slots.map((slot) => slot.name),
  );
  const replacements = new Map<string, string>();
  for (const slot of template.slots) {
    if (!Object.hasOwn(data, slot.name)) {
      if (slot.required) throw new TypeError(`Missing required slot: ${slot.name}`);
      continue;
    }
    const object = template.objects.find((object) => object.id === slot.objectId)!;
    replacements.set(
      object.id,
      valueFor(object.kind, data[slot.name], slot.maxLength ?? bounds.text),
    );
  }
  let total = 0;
  const objects = template.objects.map((object) => {
    const value = replacements.get(object.id) ?? object.value;
    total += value.length;
    if (total > bounds.total) throw new RangeError('Total text limit exceeded');
    return { ...object, value };
  });
  return { width: template.width, height: template.height, objects };
}
