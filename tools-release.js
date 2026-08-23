/*
 * Cuts a release: bumps versionCode, builds, and publishes the APK to
 * GitHub as tag "v<versionCode>".
 *
 * The app compares its own versionCode against that tag, so the tag is the
 * single source of truth for "is there an update" — no version-string parsing.
 *
 *   node tools-release.js            bump, build, publish
 *   node tools-release.js --dry      bump and build only
 *
 * Note: the APK is debug-signed with this machine's keystore. Android only
 * accepts an update signed with the same key, so releases must keep coming
 * from here. Building elsewhere means uninstall-then-install.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const GRADLE = path.join(ROOT, 'android', 'app', 'build.gradle');
const APK = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const DRY = process.argv.includes('--dry');

function sh(cmd, args, opts) {
  return execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
}

// ---- bump versionCode -----------------------------------------------------
let gradle = fs.readFileSync(GRADLE, 'utf8');
const m = gradle.match(/versionCode\s+(\d+)/);
if (!m) throw new Error('versionCode not found in ' + GRADLE);

const next = parseInt(m[1], 10) + 1;
gradle = gradle
  .replace(/versionCode\s+\d+/, 'versionCode ' + next)
  .replace(/versionName\s+"[^"]*"/, 'versionName "1.' + next + '"');
fs.writeFileSync(GRADLE, gradle);
console.log('versionCode ' + m[1] + ' -> ' + next);

// ---- build ----------------------------------------------------------------
const JAVA_HOME = process.env.JAVA_HOME
  || 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.8-hotspot';
const ANDROID_HOME = process.env.ANDROID_HOME
  || path.join(process.env.USERPROFILE || '', 'Android', 'sdk');

console.log('building…');
sh(process.platform === 'win32' ? 'cmd' : 'sh',
   process.platform === 'win32' ? ['/c', 'gradlew.bat', 'assembleDebug', '--no-daemon', '--console=plain']
                                : ['-c', './gradlew assembleDebug --no-daemon --console=plain'],
   { cwd: path.join(ROOT, 'android'), env: { ...process.env, JAVA_HOME, ANDROID_HOME } });

if (!fs.existsSync(APK)) throw new Error('build produced no APK at ' + APK);

const named = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug',
                        'nyaarank-v' + next + '.apk');
fs.copyFileSync(APK, named);
console.log('apk: ' + named + '  (' + Math.round(fs.statSync(named).size / 1024) + ' KB)');

if (DRY) { console.log('--dry: stopping before publish'); process.exit(0); }

// ---- publish --------------------------------------------------------------
const notes = process.env.RELEASE_NOTES || ('Build ' + next);
sh('git', ['add', '-A']);
try { sh('git', ['commit', '-m', 'Release v' + next]); }
catch (e) { console.log('(nothing to commit)'); }
sh('git', ['push', 'origin', 'main']);
sh('gh', ['release', 'create', 'v' + next, named,
          '--title', 'Build ' + next, '--notes', notes]);
console.log('published v' + next);
