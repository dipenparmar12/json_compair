// Helpers for large JSON parsing and streaming.
// Uses Oboe.js when available to stream parse large JSON files (process items progressively).
// Falls back to synchronous parse for small payloads or if oboe is not present.

(function(){
  function parseLargeJSONBlob(blob, options) {
    options = options || {};
    const sizeThreshold = options.threshold || (200 * 1024); // 200KB

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('File read failed'));
      reader.onload = () => {
        const text = reader.result;
        // If oboe is available and payload is large, use streaming parse
        if (window.oboe && text.length > sizeThreshold) {
          try {
            const items = [];
            oboe(text)
              .node('!*', function(node) {
                // Collect nodes? depends on path; simplest: collect top-level array items
                items.push(node);
                return oboe.drop; // drop to free memory
              })
              .done(function() { resolve(items); })
              .fail(function(err) { reject(err); });
          } catch (e) { reject(e); }
        } else {
          // Small payload or no oboe: parse normally
          try { resolve(JSON.parse(text)); } catch (e) { reject(e); }
        }
      };
      reader.readAsText(blob);
    });
  }

  window.LargeJSON = {
    parseLargeJSONBlob
  };
})();
