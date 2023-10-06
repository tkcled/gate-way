export declare class Headers implements Iterable<[string, string]> {
  constructor(init?: HeadersInit)

  append(name: string, value: string): void
  delete(name: string): void
  get(name: string): string | null
  has(name: string): boolean
  set(name: string, value: string): void

  entries(): Iterator<[string, string]>
  keys(): Iterator<string>
  values(): Iterator<string>
  [Symbol.iterator](): Iterator<[string, string]>
}
