import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/electron/renderer";
import App from "./App";
import UpdateHelperApp from "./UpdateHelperApp";
import "./styles.css";

Sentry.init();

const isUpdaterHelperRoute = window.location.hash.startsWith("#/update-helper");
const RootComponent = isUpdaterHelperRoute ? UpdateHelperApp : App;

createRoot(document.getElementById("root")!).render(
  <RootComponent />,
);
