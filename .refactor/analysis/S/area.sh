# area predicate: prints 1 if path in S's area (server)
inarea() {
  case "$1" in
    src/app/api/*|src/lib/*|src/db/*|src/clients/*|src/auth.ts|src/auth-providers.ts|src/auth-providers.test.ts) return 0;;
    src/app/*/actions.ts|src/app/*/*/actions.ts|src/app/*/actions.test.ts) return 0;;
  esac
  return 1
}
