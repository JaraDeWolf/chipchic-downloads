// Runs while GitHub builds the apps, just before the Mac app is put into its .dmg.
// The Mac app isn't signed by Apple (that costs money every year), but newer Macs refuse to open an app with no
// signature at all ("damaged"). A free "ad-hoc" signature fixes that: people then only need "Open Anyway" once.
const { execFileSync } = require("child_process");
const path = require("path");
const { Arch } = require("builder-util");

exports.default = async function (context) {
  if (context.electronPlatformName !== "darwin") return;
  if (context.arch !== Arch.universal) return; // only the finished app (Apple chips + Intel together)
  const app = path.join(context.appOutDir, context.packager.appInfo.productFilename + ".app");
  console.log("  • ad-hoc signing " + app);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });
};
