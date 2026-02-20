import { TreeEventBus } from "./events";
import { moodleTreeProvider } from "./providers/moodleTreeProvider";
import { TreeService } from "./service";

export const treeEvents = new TreeEventBus();
export const treeService = new TreeService(moodleTreeProvider, treeEvents);
