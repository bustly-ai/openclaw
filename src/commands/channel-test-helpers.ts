import { setActivePluginRegistry } from "../plugins/runtime.js";
import {
  createDiscordTestPlugin,
  createSignalTestPlugin,
  createSlackTestPlugin,
  createTelegramTestPlugin,
  createWhatsAppTestPlugin,
} from "../test-utils/channel-plugin-stubs.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import { createIMessageTestPlugin } from "../test-utils/imessage-test-plugin.js";

export function setDefaultChannelPluginRegistryForTests(): void {
  const channels = [
    { pluginId: "discord", plugin: createDiscordTestPlugin(), source: "test" },
    { pluginId: "slack", plugin: createSlackTestPlugin(), source: "test" },
    { pluginId: "telegram", plugin: createTelegramTestPlugin(), source: "test" },
    { pluginId: "whatsapp", plugin: createWhatsAppTestPlugin(), source: "test" },
    { pluginId: "signal", plugin: createSignalTestPlugin(), source: "test" },
    { pluginId: "imessage", plugin: createIMessageTestPlugin(), source: "test" },
  ] as unknown as Parameters<typeof createTestRegistry>[0];
  setActivePluginRegistry(createTestRegistry(channels));
}
