// js/result.ts: the result of an operation that can fail, as a discriminated union.
// The caller has to check ok before it can reach value, so a failure cannot be forgotten.

export type Result<T, E extends Error = Error> = { ok: true; value: T } | { ok: false; error: E };

// never in the other half: ok(x) fits any Result<T, E>, fail(e) fits any Result<T, E> as well
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const fail = <E extends Error>(error: E): Result<never, E> => ({ ok: false, error });
