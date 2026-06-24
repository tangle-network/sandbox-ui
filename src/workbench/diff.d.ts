// `diff` (jsdiff) v5 does not resolve its bundled types under moduleResolution:
// "bundler", and @types/diff is a deprecated stub. Declare the surface we use.
declare module "diff" {
  export function createTwoFilesPatch(
    oldFileName: string,
    newFileName: string,
    oldStr: string,
    newStr: string,
    oldHeader?: string,
    newHeader?: string,
    options?: { context?: number },
  ): string
  export function diffLines(
    oldStr: string,
    newStr: string,
    options?: Record<string, unknown>,
  ): Array<{ value: string; added?: boolean; removed?: boolean; count?: number }>
}
