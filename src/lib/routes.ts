export function collectionPath(kind: string) {
  return kind === "3d" ? "3d-studio" : kind;
}

export function collectionKind(path: string) {
  return path === "3d-studio" ? "3d" : path;
}
