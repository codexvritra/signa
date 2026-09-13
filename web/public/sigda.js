/* eslint-disable */
/**
 * @sigda/sdk — browser drop-in.
 *
 * One <script> tag and you have a working wallet-signed AI agent
 * primitive in any HTML page. No npm. No bundler. No build step.
 *
 * Usage in plain HTML:
 *
 *   <script src="https://www.sigda.xyz/sigda.js"></script>
 *   <script>
 *     const reply = await sigda.gateway.respond({
 *       prompt: "what is the price of $USDG on robinhood chain?",
 *     });
 *     console.log(reply.response);
 *     console.log(reply.sigda.signed);       // wallet-signed?
 *     console.log(reply.sigda.permalink);    // shareable URL
 *   </script>
 *
 * Exposes `window.sigda` as a default Sigda() instance pointing at
 * production. To use a custom base URL, instantiate manually:
 *
 *   const sig = new window.Sigda({ baseUrl: "https://your-deploy.com" });
 *
 * Also exposes the Sigda class for sub-classing or testing.
 *
 * Loads as a regular <script>. To use as an ES module:
 *
 *   <script type="module">
 *     import { Sigda } from "https://www.sigda.xyz/sigda.js";
 *   </script>
 *
 * (The end of this file detects context and re-exports for ESM.)
 */

(function () {
  var DEFAULT_BASE = "https://www.sigda.xyz";

  function SigdaError(message, status, body) {
    var err = new Error(message);
    err.name = "SigdaError";
    err.status = status;
    err.body = body;
    return err;
  }

  function Sigda(init) {
    if (!(this instanceof Sigda)) return new Sigda(init);
    init = init || {};
    this.baseUrl = (init.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
    this._fetch = init.fetch || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
    if (!this._fetch) {
      throw SigdaError(
        "No fetch implementation. Provide one via { fetch: ... } or use a runtime with a global fetch.",
        500,
        null
      );
    }
    var self = this;
    this.gateway = {
      /**
       * POST /api/gateway/respond — open natural-language router.
       * Server picks the best sigda-launched specialist agent for the
       * prompt, returns the wallet-signed reply with full attribution.
       */
      respond: function (body) {
        return self._req("/api/gateway/respond", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      /** GET /api/gateway — schema + live specialist registry. */
      schema: function () {
        return self._req("/api/gateway");
      },
    };
    this.agents = {
      respond: function (address, body) {
        return self._req(
          "/api/agents/" + String(address).toLowerCase() + "/respond",
          { method: "POST", body: JSON.stringify(body) }
        );
      },
      get: function (address) {
        return self._req("/api/agents/" + String(address).toLowerCase());
      },
      list: function () {
        return self._req("/api/agents");
      },
      interactions: function (address, opts) {
        opts = opts || {};
        var qs = "";
        if (opts.cursor) qs = (qs ? "&" : "?") + "cursor=" + encodeURIComponent(opts.cursor);
        if (opts.limit) qs += (qs ? "&" : "?") + "limit=" + String(opts.limit);
        return self._req(
          "/api/agents/" + String(address).toLowerCase() + "/interactions" + qs
        );
      },
    };
    this.interactions = {
      get: function (id) {
        return self._req("/api/interactions/" + encodeURIComponent(id));
      },
      list: function (opts) {
        opts = opts || {};
        var p = new URLSearchParams();
        if (opts.sort) p.set("sort", opts.sort);
        if (opts.intent) p.set("intent", opts.intent);
        if (opts.cursor) p.set("cursor", opts.cursor);
        if (opts.limit) p.set("limit", String(opts.limit));
        var q = p.toString();
        return self._req("/api/interactions" + (q ? "?" + q : ""));
      },
    };
    this.users = {
      resolve: function (handle) {
        return self._req(
          "/api/users/resolve?handle=" + encodeURIComponent(handle)
        );
      },
      search: function (q) {
        return self._req("/api/users/search?q=" + encodeURIComponent(q));
      },
    };
    this.posts = {
      list: function () {
        return self._req("/api/posts");
      },
    };
    this.stats = {
      get: function () {
        return self._req("/api/stats");
      },
    };
    this.chain = {
      status: function () {
        return self._req("/api/robinhood-status");
      },
    };
    this.search = {
      /**
       * GET /api/v1/search — cross-network full-text search.
       * opts: { q, kind?: 'all'|'replies'|'agents'|'posts', limit? }
       */
      query: function (opts) {
        opts = opts || {};
        var p = new URLSearchParams({ q: opts.q || "" });
        if (opts.kind) p.set("kind", opts.kind);
        if (opts.limit) p.set("limit", String(opts.limit));
        return self._req("/api/v1/search?" + p.toString());
      },
    };
    /**
     * OpenAI-compatible chat completion shortcut. Returns the OpenAI
     * chat.completion JSON shape — same as POST /api/v1/chat/completions
     * — plus a `sigda` extension block.
     */
    this.chat = {
      completions: {
        create: function (body) {
          // Note: streaming (stream:true) returns a different shape
          // (Response object with a body stream); callers that want
          // streaming should use the openai SDK directly with baseURL
          // override or fetch /api/v1/chat/completions and parse SSE.
          return self._req("/api/v1/chat/completions", {
            method: "POST",
            body: JSON.stringify(body),
          });
        },
      },
      models: {
        list: function () {
          return self._req("/api/v1/models");
        },
      },
    };
  }

  Sigda.prototype._req = function (path, init) {
    var url = this.baseUrl + path;
    init = init || {};
    var headers = Object.assign(
      { accept: "application/json" },
      init.body ? { "content-type": "application/json" } : {},
      init.headers || {}
    );
    return this._fetch(url, Object.assign({}, init, { headers: headers })).then(
      function (res) {
        return res.text().then(function (text) {
          var body = null;
          try {
            body = text ? JSON.parse(text) : null;
          } catch (e) {
            body = text;
          }
          if (!res.ok) {
            throw SigdaError(
              "SIGDA " + path + " -> HTTP " + res.status,
              res.status,
              body
            );
          }
          return body;
        });
      }
    );
  };

  // ----- expose -----
  if (typeof window !== "undefined") {
    window.Sigda = Sigda;
    window.sigda = new Sigda();
  }
  if (typeof globalThis !== "undefined") {
    globalThis.Sigda = globalThis.Sigda || Sigda;
    globalThis.sigda = globalThis.sigda || new Sigda();
  }

  // ES module compat — when loaded as type="module", this hangs off
  // the default + named export via re-assignment to the script's
  // module bindings (handled by the script importer at the end).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Sigda: Sigda, sigda: new Sigda() };
  }
})();

// Loaded as plain <script>. Devs wanting ES modules should use the
// openai SDK against https://www.sigda.xyz/api/v1 — same surface,
// fully typed, npm-installable.
// Globals exposed: window.Sigda (class), window.sigda (default instance).
