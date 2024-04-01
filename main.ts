import { App, Notice, MarkdownView, Scope, Plugin, PluginSettingTab, Setting } from "obsidian";

interface HemingwayModePluginSettings {
  enabled: boolean;
  allowBackspace: boolean;
  showToggleNotice: boolean;
  showStatusBar: boolean;
  statusBarText: string;
}

const HEMINGWAY_MODE_CLASS = "hemingway";

const DEFAULT_SETTINGS: HemingwayModePluginSettings = {
  enabled: false,
  allowBackspace: false,
  showToggleNotice: true,
  showStatusBar: true,
  statusBarText: "Hemingway",
};

export default class HemingwayModePlugin extends Plugin {
  settings: HemingwayModePluginSettings;
  keyMapScope: Scope;
  statusBar: HTMLElement;
  keymapInstalled: boolean;

  async onload() {
    this.addSettingTab(new HemingwayModeSettingTab(this.app, this));

    this.addCommand({
      id: "toggle-active",
      name: "Toggle active",
      callback: async () => {
        this.settings.enabled = !this.settings.enabled;
        await this.saveSettings();
        await this.updateStatus();
      },
    });

    this.addCommand({
      id: "set-active",
      name: "Set active",
      callback: async () => {
        this.settings.enabled = true;
        await this.saveSettings();
        await this.updateStatus();
      },
    });

    this.addCommand({
      id: "set-inactive",
      name: "Set inactive",
      callback: async () => {
        this.settings.enabled = false;
        await this.saveSettings();
        await this.updateStatus();
      },
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", async () => {
        await this.updateStatus(true);
      })
    );

    await this.loadSettings();
    this.buildKeyMapScope(this.settings.allowBackspace);
    this.keymapInstalled = false;
    await this.updateStatus(true);

    this.registerInterval(
      window.setInterval(async () => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView && this.settings.enabled) {
          if (markdownView.editor.hasFocus()) {
            await this.installHemingwayKeymap();
          } else {
            await this.uninstallHemingwayKeymap();
          }
        }
      }, 500)
    );

    const statusBarItem = this.addStatusBarItem();
    this.statusBar = statusBarItem.createSpan();
    this.statusBar.addClass("hemingway-mode-status");
  }

  async onunload() {
    if (this.settings.enabled) {
      await this.uninstallHemingwayKeymap();
      await this.restoreView();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onExternalSettingsChange() {
    this.updateStatus(true);
  }

  buildKeyMapScope(allowBackspace: boolean) {
    this.keyMapScope = new Scope(this.app.scope);
    const nop = () => false;
    const voidKeys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "End",
      "Home",
      "PageUp",
      "PageDown",
      "Delete",
      "Clear",
      "Cut",
      "EraseEof",
      "Redo",
      "Undo",
    ];

    if (!allowBackspace) {
      voidKeys.push("Backspace");
    }

    for (const key of voidKeys) {
      this.keyMapScope.register([], key, nop);
      this.keyMapScope.register(["Meta"], key, nop);
      this.keyMapScope.register(["Alt"], key, nop);
      this.keyMapScope.register(["Ctrl"], key, nop);
      this.keyMapScope.register(["Shift"], key, nop);
      this.keyMapScope.register(["Mod"], key, nop);
      this.keyMapScope.register(["Meta", "Shift"], key, nop);
      this.keyMapScope.register(["Alt", "Shift"], key, nop);
      this.keyMapScope.register(["Ctrl", "Shift"], key, nop);
      this.keyMapScope.register(["Shift", "Shift"], key, nop);
      this.keyMapScope.register(["Mod", "Shift"], key, nop);
    }

    this.keyMapScope.register(["Meta"], "Z", nop); // Undo
    this.keyMapScope.register(["Meta"], "A", nop); // Select all
  }

  async updateStatus(quiet = false) {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!markdownView) {
      await this.uninstallHemingwayKeymap();
      await this.restoreView();
      return;
    }

    this.statusBar.setText(this.settings.showStatusBar && this.settings.enabled ? this.settings.statusBarText : "");

    if (this.settings.enabled) {
      await this.installHemingwayKeymap();
      await this.setupView();
    } else {
      await this.uninstallHemingwayKeymap();
      await this.restoreView();
    }

    if (this.settings.showToggleNotice && !quiet) {
      new Notice(`Hemingway mode ${this.settings.enabled ? "active" : "inactive"}`, 2000);
    }
  }

  async installHemingwayKeymap() {
    if (this.keymapInstalled) return;
    this.app.keymap.pushScope(this.keyMapScope);
    this.keymapInstalled = true;
  }

  async uninstallHemingwayKeymap() {
    if (!this.keymapInstalled) return;
    this.app.keymap.popScope(this.keyMapScope);
    this.keymapInstalled = false;
  }

  async setupView() {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (markdownView) {
      markdownView.editor?.setCursor({ line: 99999999, ch: 0 });
      markdownView.contentEl.addClass(HEMINGWAY_MODE_CLASS);
      markdownView.contentEl.addEventListener("click", this.mouseEventListener.bind(this));
    }
  }

  async restoreView() {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (markdownView) {
      markdownView.contentEl.removeClass(HEMINGWAY_MODE_CLASS);
      markdownView.contentEl.removeEventListener("click", this.mouseEventListener.bind(this));
    }
  }

  mouseEventListener(ev: MouseEvent) {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    markdownView?.editor?.focus();
  }
}

class HemingwayModeSettingTab extends PluginSettingTab {
  plugin: HemingwayModePlugin;

  constructor(app: App, plugin: HemingwayModePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Hemingway mode enabled")
      .setDesc("Prevents any editing, so you can only write ahead.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
          await this.plugin.updateStatus(true);
        })
      );

    new Setting(containerEl)
      .setName("Show activation state in status bar")
      .setDesc("Shows in the status bar when the write-only mode is active.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
          this.plugin.settings.showStatusBar = value;
          await this.plugin.saveSettings();
          await this.plugin.updateStatus(true);
          this.display();
        })
      );

    if (this.plugin.settings.showStatusBar) {
      new Setting(containerEl)
        .setName("Text to show in status bar")
        .setDesc("Appears in status bar when the write-only mode is active.")
        .addText((text) =>
          text.setValue(this.plugin.settings.statusBarText).onChange(async (value) => {
            this.plugin.settings.statusBarText = value;
            await this.plugin.saveSettings();
            await this.plugin.updateStatus(true);
          })
        );
    }

    new Setting(containerEl)
      .setName("Show notice when toggling status")
      .setDesc("Helps noticing changes between enabled and disabled.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showToggleNotice).onChange(async (value) => {
          this.plugin.settings.showToggleNotice = value;
          await this.plugin.saveSettings();
          await this.plugin.updateStatus(true);
        })
      );

    new Setting(containerEl)
      .setName("Allow using Backspace key even if active")
      .setDesc("Allows deleting text with Backspace. This is useful for lousy typists.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.allowBackspace).onChange(async (value) => {
          this.plugin.settings.allowBackspace = value;
          await this.plugin.saveSettings();
          this.plugin.buildKeyMapScope(this.plugin.settings.allowBackspace);
          await this.plugin.updateStatus(true);
        })
      );
  }
}
