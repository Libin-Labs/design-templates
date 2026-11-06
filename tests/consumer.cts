import {
  validateTemplate,
  instantiateTemplate,
  type DesignObject,
  type TemplateSlot,
  type DesignTemplate,
  type DesignDocument,
  type TemplateLimits,
} from '@lp-labs/design-templates';
const object: DesignObject = {
  id: 'title',
  kind: 'text',
  value: 'A',
  locked: false,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
};
const slot: TemplateSlot = { name: 'heading', objectId: 'title', required: true };
const input: DesignTemplate = { width: 100, height: 100, objects: [object], slots: [slot] };
const limits: TemplateLimits = { maxObjects: 10 };
const result: DesignDocument = instantiateTemplate(
  validateTemplate(input, limits),
  { heading: 'Hello' },
  limits,
);
void result;
// @ts-expect-error bindings accept strings only
instantiateTemplate(input, { heading: 1 });
