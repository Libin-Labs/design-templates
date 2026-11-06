# @lp-labs/design-templates

Bounded canvas templates with named value slots and locked objects. Produces data, never HTML.
No arbitrary property paths, URLs, expressions, or renderer dependency.

## Install and quickstart

```sh
npm install @lp-labs/design-templates
```

```js
import { instantiateTemplate, validateTemplate } from '@lp-labs/design-templates';

const template = validateTemplate({
  width: 200,
  height: 100,
  objects: [
    {
      id: 'title',
      kind: 'text',
      x: 10,
      y: 10,
      width: 180,
      height: 30,
      locked: false,
      value: 'Default',
    },
  ],
  slots: [{ name: 'heading', objectId: 'title', required: true, maxLength: 30 }],
});
const document = instantiateTemplate(template, { heading: 'Welcome' });
console.log(document.objects[0].value); // Welcome
```

## API and types

- `validateTemplate(template, limits?): DesignTemplate` validates the closed schema and returns an
  independent snapshot. Both public functions revalidate their inputs.
- `instantiateTemplate(template, bindings, limits?): DesignDocument` copies the canvas and objects,
  substitutes supplied slot strings, checks aggregate output bounds, and omits slot declarations.
- `DesignObject`: `id`, `kind` (`text`, `shape`, `asset`), finite nonnegative `x`, `y`, `width`,
  `height`, boolean `locked`, string `value`. Objects must fit the canvas. `value` means literal
  text, hex fill (`#RRGGBB` or `#RRGGBBAA`), or external asset identifier respectively.
- `TemplateSlot`: `name`, `objectId`, boolean `required`, optional positive integer `maxLength`.
  Each slot binds exactly one object's `value`; an object can have only one slot. Locked objects
  cannot be slot targets. Slot defaults must satisfy the slot's limit.
- `DesignTemplate`: positive finite `width`/`height`, readonly `objects` and `slots` arrays.
- `DesignDocument`: `width`, `height`, mutable independent `objects` array.
- `TemplateLimits`: optional `maxObjects`, `maxSlots`, `maxTextLength`, `maxTotalText`.

Missing required slots and extra binding keys fail. Missing optional slots retain defaults;
an empty string counts as supplied (and is legal only for text). All binding values must be
strings. Identifiers start with an ASCII letter, then contain letters, digits, `_`, `.`, `-`,
with maximum length 128. `constructor`, `prototype`, and `__proto__` are forbidden.
Plain/null-prototype records with own data fields only are accepted; accessors, symbol keys,
unknown schema fields, and custom prototypes are rejected without calling getters.

## Customization, errors, and limits

Define your own object positions, slot names, defaults, and locked decorative objects. Render the
result using your own trusted renderer. Do not interpret text as markup: `<`, `>`, and unsupported
C0 controls are rejected, while LF/tab/CR are literal text. Asset values are identifiers, never
SVG source, file paths, or URLs. This is not a DOM sanitizer or rich HTML templating engine.

Defaults: 1,000 objects, 1,000 slots, 10,000 UTF-16 units per value, 1,000,000 total value units.
Hard ceilings: 1,000 objects/slots, 100,000 units per value, 1,000,000 total units. Custom limits
are positive safe integers within these ceilings. Geometry is at most 1e9 per component.
Counts, text lengths, invalid numeric bounds, out-of-canvas objects, and invalid limits throw
`RangeError`. Invalid schema, identifiers, values, duplicate IDs/slots, locked bindings, missing
required bindings, and unsafe records throw `TypeError`. There is no recursive scene hierarchy,
template language, remote asset access, browser, HTML, or layout engine.

## Modules and development

Independent ESM/CJS with declarations and no runtime/peer dependencies.
CommonJS: `const { validateTemplate, instantiateTemplate } = require('@lp-labs/design-templates')`.
TypeScript ^5.9.3 and Prettier ^3.6.2 are development-only.
Run `npm run build`, `npm run typecheck`, `npm test`, `npm run format`, `npm run format:check`.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
