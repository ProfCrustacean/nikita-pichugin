const owners = new Set<string>();

function syncDocumentLock() {
  document.documentElement.classList.toggle("is-scroll-locked", owners.size > 0);
}

export function acquireDocumentScrollLock(owner: string): () => void {
  owners.add(owner);
  syncDocumentLock();
  let released = false;

  return () => {
    if (released) return;
    released = true;
    owners.delete(owner);
    syncDocumentLock();
  };
}
