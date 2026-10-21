// React's streaming runtime marks a Suspense boundary whose content has arrived from the server but
// waits, hidden, for its reveal on a later frame with this comment ($RC queues it, $RV reveals it).
const QUEUED = "$~";

function revealQueued() {
  const comments = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
  for (let node = comments.nextNode(); node; node = comments.nextNode()) {
    if (node.nodeValue === QUEUED) return true;
  }
  return false;
}

// Resolves on the first frame on which no streamed part of the page waits to be revealed.
export function revealsSettled() {
  return new Promise<void>((resolve) => {
    const check = () =>
      revealQueued() ? requestAnimationFrame(check) : resolve();
    check();
  });
}
