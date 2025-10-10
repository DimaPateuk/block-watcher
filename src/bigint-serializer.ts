export function enableBigIntJsonSerialization() {
  // avoid double patch
  if ((JSON as any)._bigintPatched) return;

  const _stringify = JSON.stringify;
  const replacer = (_k: string, v: unknown) =>
    typeof v === "bigint" ? v.toString() : v;

  JSON.stringify = (value: any, replacerArg?: any, space?: any) =>
    _stringify(value, replacerArg ?? replacer, space);

  (JSON as any)._bigintPatched = true;
}
