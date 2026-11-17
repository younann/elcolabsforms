// resolves the virtual module in tests; specs mock it
export function useRegisterSW(): never {
  throw new Error('mock virtual:pwa-register/react in the test');
}
