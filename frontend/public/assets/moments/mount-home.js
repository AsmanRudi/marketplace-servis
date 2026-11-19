window.__momentsManual = true;

const root = document.getElementById('root');
let current;
let moments;

function sync() {
  const next = root.querySelector('.hero');
  if (next === current) return;
  if (current) moments?.unmountAll(current);
  current = next;
  if (!next) return;
  import('./moments.js').then(module => {
    moments = module;
    if (current === next) void module.mountAll(next);
  }).catch(() => { /* The photograph remains visible without motion. */ });
}

new MutationObserver(sync).observe(root,{ childList:true,subtree:true });
sync();
