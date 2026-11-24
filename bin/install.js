#!/usr/bin/env node
"use strict";

// Downloads the kttn binary for this platform from the GitHub release that
// matches package.json, checks it against SHA256SUMS and puts it in
// bin/native. Runs as npm's postinstall and again from bin/kttn on the first
// run if that was skipped. A failure never fails `npm install`: the first
// run tries again.

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const tls = require("tls");
const { spawnSync } = require("child_process");

const pkg = require("../package.json");
const platformMap = { darwin: "darwin", linux: "linux" };
const archMap = { x64: "amd64", arm64: "arm64" };
const goos = platformMap[os.platform()];
const goarch = archMap[os.arch()];
const version = pkg.version;
const asset = `kttn_${version}_${goos}_${goarch}.tar.gz`;
const baseUrl = `https://github.com/hgwk/kttn/releases/download/v${version}`;
const outDir = path.join(__dirname, "native");

// proxyFor honours HTTPS_PROXY / HTTP_PROXY (either case) unless NO_PROXY
// names the host.
function proxyFor(target) {
  const env = process.env;
  const noProxy = (env.NO_PROXY || env.no_proxy || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (noProxy.some((rule) => rule === "*" || target.hostname === rule.replace(/^\./, "") || target.hostname.endsWith(rule.startsWith(".") ? rule : "." + rule))) {
    return null;
  }
  const raw = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
  return raw ? new URL(raw) : null;
}

// An agent that opens HTTPS through an HTTP CONNECT proxy.
class TunnelAgent extends https.Agent {
  constructor(proxy) {
    super({ keepAlive: false });
    this.proxy = proxy;
  }
  createConnection(options, done) {
    const proxy = this.proxy;
    const headers = {};
    if (proxy.username) {
      const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
      headers["Proxy-Authorization"] = "Basic " + Buffer.from(auth).toString("base64");
    }
    const lib = proxy.protocol === "https:" ? https : http;
    const req = lib.request({
      host: proxy.hostname,
      port: proxy.port || (proxy.protocol === "https:" ? 443 : 80),
      method: "CONNECT",
      path: `${options.host}:${options.port || 443}`,
      headers,
    });
    req.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        done(new Error(`proxy refused CONNECT: HTTP ${res.statusCode}`));
        return;
      }
      done(null, tls.connect({ socket, servername: options.servername || options.host }));
    });
    req.on("error", done);
    req.end();
  }
}

// get fetches a URL into a Buffer, following up to five redirects (relative
// ones included). Every failure ends up as a rejection.
function get(targetUrl, redirects = 0) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(targetUrl);
      if (target.protocol !== "https:") throw new Error(`refusing ${target.protocol} download`);
    } catch (err) {
      reject(err);
      return;
    }
    const proxy = proxyFor(target);
    const req = https.get(target, { agent: proxy ? new TunnelAgent(proxy) : undefined }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 5) {
          reject(new Error("too many redirects"));
          return;
        }
        get(new URL(res.headers.location, target).toString(), redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`download failed: HTTP ${res.statusCode} for ${target.pathname}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("download timed out")));
  });
}

async function install(tmp) {
  const archive = await get(`${baseUrl}/${asset}`);
  const sums = (await get(`${baseUrl}/SHA256SUMS`)).toString("utf8");
  const row = sums.split(/\r?\n/).map((line) => line.trim().split(/\s+/)).find((parts) => parts[1] === asset);
  if (!row) throw new Error(`checksum missing for ${asset}`);
  const actual = crypto.createHash("sha256").update(archive).digest("hex");
  if (actual !== row[0]) throw new Error(`checksum mismatch for ${asset}`);
  const file = path.join(tmp, asset);
  fs.writeFileSync(file, archive);
  const tar = spawnSync("tar", ["-xzf", file, "-C", tmp], { stdio: "inherit" });
  if (tar.status !== 0) throw new Error("could not unpack the archive");
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, "kttn");
  const staged = target + ".tmp";
  fs.copyFileSync(path.join(tmp, `kttn_${version}_${goos}_${goarch}`, "kttn"), staged);
  fs.chmodSync(staged, 0o755);
  fs.renameSync(staged, target);
}

(async () => {
  if (!goos || !goarch) {
    console.error(`kttn: ${os.platform()}/${os.arch()} is not supported (macOS and Linux on arm64 or x86-64 only).`);
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kttn-install-"));
  try {
    await install(tmp);
  } catch (err) {
    console.error(`kttn: could not download the binary yet (${err.message}).`);
    console.error("kttn: it is fetched again the first time you run kttn; or download it from https://github.com/hgwk/kttn/releases");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
