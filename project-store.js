// Drafts are scoped to this app path, separate from the offline app cache.
export function createDraftStore(indexedDB, scope) {
  let connection = null;
  let revision = null;
  const name = 'wallstory-drafts-' + scope;

  function open() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      if (!indexedDB) { reject(Error('Device storage is unavailable.')); return; }
      let settled = false;
      const request = indexedDB.open(name, 1);
      const timer = setTimeout(() => fail(Error('Device storage did not respond.')), 8000);
      function fail(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('drafts')) request.result.createObjectStore('drafts');
      };
      request.onerror = () => fail(request.error || Error('Device storage is unavailable.'));
      request.onblocked = () => fail(Error('Close other Wallstory windows and try again.'));
      request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        settled = true;
        clearTimeout(timer);
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
    }).catch(error => { connection = null; throw error; });
    return connection;
  }

  async function transact(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('drafts', mode);
      let result, failure;
      const timer = setTimeout(() => {
        failure = Error('Saving took too long. Please try again.');
        transaction.abort();
      }, 10000);
      transaction.oncomplete = () => { clearTimeout(timer); resolve(result); };
      transaction.onabort = transaction.onerror = () => {
        clearTimeout(timer);
        reject(failure || transaction.error || Error('Your wall could not be saved.'));
      };
      action(transaction.objectStore('drafts'), value => { result = value; }, error => {
        failure = error;
        transaction.abort();
      });
    });
  }

  return {
    async load() {
      const record = await transact('readonly', (store, done) => {
        const request = store.get('current');
        request.onsuccess = () => done(request.result || null);
      });
      revision = record?.revision ?? null;
      return record?.project ?? null;
    },
    async write(project) {
      const next = crypto.randomUUID();
      await transact('readwrite', (store, done, abort) => {
        const request = store.get('current');
        request.onsuccess = () => {
          if ((request.result?.revision ?? null) !== revision) {
            const error = Error('Another Wallstory window saved a different wall. Download this project before reopening.');
            error.name = 'DraftConflictError';
            abort(error);
            return;
          }
          try {
            store.put({ revision: next, savedAt: Date.now(), project }, 'current');
            done(true);
          } catch (error) { abort(error); }
        };
      });
      // A request succeeding is not enough: only acknowledge a committed transaction.
      revision = next;
    }
  };
}

export function createAutosaver(write, onStatus) {
  let pending = null, running = null, failure = null;
  let revision = 0, savedRevision = 0;

  async function drain() {
    while (pending) {
      const next = pending;
      pending = null;
      try {
        await write(next.project);
        savedRevision = next.revision;
        failure = null;
      } catch (error) {
        pending ||= next;
        failure = error;
        onStatus('error', error);
        return false;
      }
    }
    onStatus('saved');
    return true;
  }

  async function flush() {
    do {
      if (!running && pending) running = drain().finally(() => { running = null; });
      if (running && !(await running)) return false;
    } while (pending);
    return !failure;
  }

  return {
    queue(project) {
      pending = { project, revision: ++revision };
      onStatus('saving');
      void flush();
    },
    flush,
    isSaved: () => savedRevision === revision && !failure,
    error: () => failure
  };
}
