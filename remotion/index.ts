import { registerRoot } from "remotion";
import "../app/globals.css";
import { RemotionRoot } from "./Root";

// Register the root component to inform Remotion which components to render.
registerRoot(RemotionRoot);
