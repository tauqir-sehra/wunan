# Contract: API (Home)

Adds to the earlier API contracts; conventions (base path `/api/v1`, bearer tokens, error shape) are
unchanged. `apps/api/src/openapi.test.ts` reads this file too.

## Home

| Endpoint | Access | Behaviour |
|----------|--------|-----------|
| `GET /me/home` | member | → `Home` ([data-model.md](../data-model.md)): `arrangements`, `dueBack`, `offers`, `askedToChange`, each complete and ordered oldest first (`dueBack` by due day). Only the caller's own things. Never includes arrangements the caller only helps with. |
| `POST /me/home/pressed` | member | Body `{ kind: 'offers', requestId }` or `{ kind: 'askedToChange', subject: 'offering' \| 'request', id }`. Marks that line's unpressed links or flags as pressed → `204`. `404` if the request or thing isn't the caller's. Repeating it is harmless (`204`). |

The header's `GET /me/summary` is unchanged.
