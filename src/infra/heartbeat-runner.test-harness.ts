import { beforeEach } from "vitest";
import type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import {
  createSlackTestPlugin,
  createTelegramTestPlugin,
  createWhatsAppTestPlugin,
} from "../test-utils/channel-plugin-stubs.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";

const slackChannelPlugin = createSlackTestPlugin() as unknown as ChannelPlugin;
const telegramChannelPlugin = createTelegramTestPlugin() as unknown as ChannelPlugin;
const whatsappChannelPlugin = createWhatsAppTestPlugin() as unknown as ChannelPlugin;

export function installHeartbeatRunnerTestRuntime(params?: { includeSlack?: boolean }): void {
  beforeEach(() => {
    if (params?.includeSlack) {
      setActivePluginRegistry(
        createTestRegistry([
          { pluginId: "slack", plugin: slackChannelPlugin, source: "test" },
          { pluginId: "whatsapp", plugin: whatsappChannelPlugin, source: "test" },
          { pluginId: "telegram", plugin: telegramChannelPlugin, source: "test" },
        ]),
      );
      return;
    }
    setActivePluginRegistry(
      createTestRegistry([
        { pluginId: "whatsapp", plugin: whatsappChannelPlugin, source: "test" },
        { pluginId: "telegram", plugin: telegramChannelPlugin, source: "test" },
      ]),
    );
  });
}
