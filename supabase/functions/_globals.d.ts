// Ambient declarations so VSCode doesn't flag Deno Edge Function globals
declare module "https://*";

declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
  };
}
