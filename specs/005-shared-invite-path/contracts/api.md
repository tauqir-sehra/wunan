# Contract: API (changes for how you're connected)

Changes to the [001 API contract](../../001-community-resource-sharing/contracts/api.md), whose
conventions (base path `/api/v1`, bearer tokens, error shape) are unchanged. The OpenAPI contract
test (`apps/api/src/openapi.test.ts`) reads this file too.

## Members

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /members/{id}` | member | As 001, plus `connection` for the signed-in caller (shape below). Unconfirmed sign-ups: `404` as today. |

**Removed**: `GET /members/{id}/chain`. Its row is taken out of 001's contract (FR-009).

### Shapes

**person**: `{ id, displayName, isFounder, isFormerMember }`. `displayName` ends with
"(no longer a member)" when `isFormerMember`, as everywhere else.

**connection**

```text
{
  kind: 'self' | 'shared' | 'theyAreAbove' | 'youAreAbove' | 'separate',
  top: person | null,      // null only for 'separate'
  toYou: person[],         // from just below `top` down to the caller, in order
  toThem: person[]         // from just below `top` down to the profile's member, in order
}
```

Which `kind` applies and what each list holds is defined in [data-model.md](../data-model.md).
`connection` contains only people on the two invite lines and only the fields profiles already show
(FR-011). It costs one database query (research §1).
