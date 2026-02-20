import { nativeImage } from "electron";
import { join } from "path";

const iconPath = join(__dirname, "resources/icon.png");
const icon = nativeImage.createFromPath(iconPath);
const hasIcon = !icon.isEmpty();

export { hasIcon, icon, iconPath };
