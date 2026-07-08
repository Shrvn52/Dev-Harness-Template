/**
 * Crude comment stripper for arch tests that regex-match SOURCE text: removes
 * block comments and `//` line tails so commented-out code (or prose that
 * mentions an identifier) can't satisfy or trip a source-level check.
 *
 * Deliberately NOT a lexer: it will mangle string literals that contain
 * comment tokens (a "http://…" URL loses its tail). Fine for the arch tests'
 * purposes — they match identifiers/import-specifiers, not strings — but
 * don't reuse this where string contents matter; parse with the TS compiler
 * API instead.
 */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
